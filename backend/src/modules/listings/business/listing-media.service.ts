import { randomUUID } from "node:crypto";
import { DataSource, EntityManager, In, LessThanOrEqual, IsNull } from "typeorm";
import { Account } from "../../accounts/business/account.entity";
import { AuthError } from "../../auth/business/auth-errors";
import { ListingMedia } from "./listing-media.entity";
import type { ListingMediaStorage } from "./listing-media-storage";
export class ListingMediaService {
    constructor(private readonly source: DataSource, private readonly storage: ListingMediaStorage) { }
    private async actor(manager: EntityManager, ownerId: string) { const account = await manager.getRepository(Account).createQueryBuilder("a").addSelect("a.loginDisabledAt").where("a.id=:id", { id: ownerId }).setLock("pessimistic_write").getOne(); if (!account)
        throw new AuthError(401, "UNAUTHENTICATED"); if (account.loginDisabledAt)
        throw new AuthError(403, "FORBIDDEN"); }
    async upload(ownerId: string, image: {
        bytes: Buffer;
        width: number;
        height: number;
    }) {
        const id = randomUUID();
        const row = await this.source.transaction(async (m) => { await this.actor(m, ownerId); const repo = m.getRepository(ListingMedia); if (await repo.countBy({ ownerId, state: In(["UPLOADING", "STAGED"]) }) >= 32)
            throw new AuthError(429, "RATE_LIMITED", 60); return repo.save(repo.create({ id, ownerId, state: "UPLOADING", publicId: "studentmart/listings/" + ownerId + "/" + id, url: null, width: image.width, height: image.height, expiresAt: new Date(Date.now() + 86400000), listingId: null })); });
        try {
            const uploaded = await this.storage.upload(row.publicId, image.bytes);
            const u = new URL(uploaded.url);
            if (u.protocol !== "https:")
                throw new Error();
            await this.source.transaction(async (m) => { await this.actor(m, ownerId); await m.getRepository(ListingMedia).update({ id, state: "UPLOADING" }, { state: "STAGED", url: u.href }); });
            return { id, url: u.href, width: row.width, height: row.height, expiresAt: row.expiresAt.toISOString() };
        }
        catch {
            await this.source.getRepository(ListingMedia).update(id, { state: "DELETING" });
            await this.cleanupOne(id);
            throw new AuthError(503, "SERVICE_UNAVAILABLE");
        }
    }
    async remove(ownerId: string, id: string) { await this.source.transaction(async (m) => { await this.actor(m, ownerId); const repo = m.getRepository(ListingMedia); const row = await repo.findOne({ where: { id, ownerId }, lock: { mode: "pessimistic_write" } }); if (!row)
        throw new AuthError(404, "NOT_FOUND"); if (row.state === "ATTACHED" || row.listingId || row.state === "UPLOADING")
        throw new AuthError(409, "MEDIA_UNAVAILABLE"); if (row.state !== "DELETED")
        await repo.update(id, { state: "DELETING" }); }); await this.cleanupOne(id); }
    async cleanupOne(id: string) { const repo = this.source.getRepository(ListingMedia); const row = await repo.findOneBy({ id, state: "DELETING" }); if (!row || row.listingId)
        return; try {
        await this.storage.destroy(row.publicId);
        await repo.update({ id, state: "DELETING", listingId: IsNull() }, { state: "DELETED", url: null });
    }
    catch { /* Durable intent retries with cleanup command. */ } }
    async cleanup() { const repo = this.source.getRepository(ListingMedia); await this.source.transaction(async (m) => { const rows = await m.getRepository(ListingMedia).find({ where: { state: In(["STAGED", "UPLOADING"]), expiresAt: LessThanOrEqual(new Date()) }, lock: { mode: "pessimistic_write" }, take: 100 }); for (const row of rows)
        if (!row.listingId)
            await m.getRepository(ListingMedia).update(row.id, { state: "DELETING" }); }); for (const row of await repo.find({ where: { state: "DELETING" }, take: 100 }))
        await this.cleanupOne(row.id); }
    /** Called only inside the future Listing create/update transaction; does not invent a Listing API. */
    async attach(manager: EntityManager, ownerId: string, ids: string[], listingId: string) { if (ids.length > 8 || new Set(ids).size !== ids.length)
        throw new AuthError(409, "MEDIA_UNAVAILABLE"); const rows: ListingMedia[] = []; for (const id of [...ids].sort()) {
        const row = await manager.getRepository(ListingMedia).findOne({ where: { id, ownerId }, lock: { mode: "pessimistic_write" } });
        if (!row || row.state !== "STAGED" || row.listingId || row.expiresAt.getTime() <= Date.now())
            throw new AuthError(409, "MEDIA_UNAVAILABLE");
        rows.push(row);
    } for (const row of rows)
        await manager.getRepository(ListingMedia).update(row.id, { state: "ATTACHED", listingId }); }
    async detach(manager: EntityManager, ownerId: string, ids: string[], listingId: string) { for (const id of [...ids].sort()) {
        const row = await manager.getRepository(ListingMedia).findOne({ where: { id, ownerId }, lock: { mode: "pessimistic_write" } });
        if (!row || row.listingId !== listingId || row.state !== "ATTACHED")
            throw new AuthError(409, "MEDIA_UNAVAILABLE");
        await manager.getRepository(ListingMedia).update(id, { state: "DELETING", listingId: null });
    } }
}
