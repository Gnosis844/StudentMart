import { createHash } from "node:crypto";
import { DataSource, EntityManager } from "typeorm";
import { Listing, ListingImage, ListingCategory, ListingMutation } from "./listing.entity";
import { ListingMediaService } from "./listing-media.service";
import { Account } from "../../accounts/business/account.entity";
import { Area } from "../../accounts/business/catalog.entity";
import { AuthError } from "../../auth/business/auth-errors";
import type { CreateListingInput } from "../presentation/listing-validation";
function canonical(v: unknown): string { if (v === null || typeof v !== "object")
    return JSON.stringify(v); if (Array.isArray(v))
    return "[" + v.map(canonical).join(",") + "]"; return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical((v as Record<string, unknown>)[k])).join(",") + "}"; }
export class ListingService {
    constructor(private readonly source: DataSource, private readonly media: ListingMediaService) { }
    async categories() { return this.source.getRepository(ListingCategory).find({ select: { id: true, code: true, name: true }, order: { name: "ASC", id: "ASC" } }); }
    private async actor(m: EntityManager, id: string) { const a = await m.getRepository(Account).createQueryBuilder("a").addSelect("a.loginDisabledAt").where("a.id=:id", { id }).setLock("pessimistic_write").getOne(); if (!a)
        throw new AuthError(401, "UNAUTHENTICATED"); if (a.loginDisabledAt)
        throw new AuthError(403, "FORBIDDEN"); }
    async read(ownerId: string, id: string, m: EntityManager = this.source.manager) { const row = await m.getRepository(Listing).findOne({ where: { id, ownerId }, relations: { owner: true, category: true, area: true } }); if (!row)
        throw new AuthError(404, "NOT_FOUND"); const images = await m.getRepository(ListingImage).find({ where: { listingId: id }, relations: { media: true }, order: { position: "ASC" } }); const common = { id: row.id, type: row.type, title: row.title, description: row.description, category: { id: row.category.id, name: row.category.name }, area: { id: row.area.id, name: row.area.name }, images: images.map(i => ({ id: i.media.id, url: i.media.url!, width: i.media.width, height: i.media.height })), owner: { id: row.owner.id, displayName: row.owner.displayName, avatarUrl: row.owner.avatarUrl }, lifecycle: { status: row.status, completion: null, removalActor: null }, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; return { ...common, ...(row.type === "SELL" ? { price: row.price, condition: row.condition } : row.type === "BUY" ? { budget: row.budget } : { condition: row.condition, exchangeWanted: row.exchangeWanted }) }; }
    async submission(actorId: string, key: string) { const r = await this.source.getRepository(ListingMutation).findOneBy({ actorId, key }); if (!r)
        throw new AuthError(404, "NOT_FOUND"); return { key: r.key, operation: r.operation, state: r.replayUntil.getTime() <= Date.now() ? "EXPIRED" : r.state, listingId: r.listingId, resultVersion: r.resultVersion, errorCode: r.errorCode, replayUntil: r.replayUntil.toISOString() }; }
    async create(actorId: string, key: string, input: CreateListingInput) {
        const hash = createHash("sha256").update("POST:/listings:" + canonical(input)).digest("hex");
        // Session advisory lock spans admission and result transactions. A dead process releases it;
        // recovery retries a PROCESSING record only after acquiring the same actor/key lock.
        const runner = this.source.createQueryRunner();
        await runner.connect();
        let locked = false;
        try {
            const locks = await runner.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked", [actorId + ":" + key]);
            locked = locks[0].locked;
            if (!locked)
                throw new AuthError(409, "IDEMPOTENCY_IN_PROGRESS", 1);
            const repo = runner.manager.getRepository(ListingMutation);
            let attempt = await repo.createQueryBuilder("m").addSelect("m.snapshot").where("m.actorId=:actorId AND m.key=:key", { actorId, key }).getOne();
            if (attempt) {
                if (attempt.hash !== hash || attempt.operation !== "CREATE")
                    throw new AuthError(409, "IDEMPOTENCY_CONFLICT");
                if (attempt.replayUntil.getTime() <= Date.now())
                    throw new AuthError(410, "IDEMPOTENCY_EXPIRED");
                if (attempt.state === "SUCCEEDED")
                    return { listing: attempt.snapshot, replayed: true };
                if (attempt.state === "FAILED")
                    throw new AuthError(attempt.errorStatus!, attempt.errorCode as any);
            }
            else
                attempt = await repo.save(repo.create({ actorId, key, hash, operation: "CREATE", state: "PROCESSING", listingId: null, resultVersion: null, errorCode: null, errorStatus: null, snapshot: null, replayUntil: new Date(Date.now() + 86400000) }));
            await runner.startTransaction();
            try {
                const m = runner.manager;
                await this.actor(m, actorId);
                if (!await m.getRepository(ListingCategory).existsBy({ id: input.categoryId }) || !await m.getRepository(Area).existsBy({ id: input.areaId }))
                    throw new AuthError(400, "VALIDATION_ERROR");
                const listing = await m.getRepository(Listing).save(m.getRepository(Listing).create({ ownerId: actorId, type: input.type, title: input.title, description: input.description, categoryId: input.categoryId, areaId: input.areaId, price: input.type === "SELL" ? input.price : null, budget: input.type === "BUY" ? input.budget : null, condition: input.type !== "BUY" ? input.condition : null, exchangeWanted: input.type === "EXCHANGE" ? input.exchangeWanted : null, status: "OPEN", version: 1 }));
                await this.media.attach(m, actorId, input.mediaIds, listing.id);
                for (const [position, mediaId] of input.mediaIds.entries())
                    await m.getRepository(ListingImage).save({ listingId: listing.id, mediaId, position });
                const dto = await this.read(actorId, listing.id, m);
                await m.getRepository(ListingMutation).update(attempt.id, { state: "SUCCEEDED", listingId: listing.id, resultVersion: 1, snapshot: dto });
                await runner.commitTransaction();
                return { listing: dto, replayed: false };
            }
            catch (error) {
                await runner.rollbackTransaction();
                if (error instanceof AuthError && error.status < 500)
                    await repo.update(attempt.id, { state: "FAILED", errorCode: error.code, errorStatus: error.status });
                throw error;
            }
        }
        finally {
            try {
                if (locked)
                    await runner.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [actorId + ":" + key]);
            }
            finally {
                await runner.release();
            }
        }
    }
}
