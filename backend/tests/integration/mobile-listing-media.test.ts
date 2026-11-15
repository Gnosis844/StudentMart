import "reflect-metadata";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { DataSource, In } from "typeorm";
import { expect, it } from "vitest";
import { Account } from "../../src/modules/accounts/business/account.entity";
import { AccountsService } from "../../src/modules/accounts/business/accounts.service";
import { AuthSession } from "../../src/modules/auth/business/auth-session.entity";
import { ListingMedia } from "../../src/modules/listings/business/listing-media.entity";
import { ListingMediaService } from "../../src/modules/listings/business/listing-media.service";
import { createAuthApi } from "../../../mobile/src/features/auth/data/auth-api";
import { createAuthCoordinator } from "../../../mobile/src/features/auth/business/auth-coordinator";
import { createListingMediaModel } from "../../../mobile/src/features/listings/business/listing-media-model";
import type { ListingImageAsset } from "../../../mobile/src/features/listings/business/listing-media";
import type { ListingMediaStorage } from "../../src/modules/listings/business/listing-media-storage";
import { loadConfig } from "../../src/shared/config/env";
import { databaseOptions } from "../../src/shared/database/database-options";
import { authApp } from "../support/auth-app";

const password = "listing-media-fixture-password";
async function fixture() {
  const config = loadConfig();
  if (!config.DATABASE_URL || new URL(config.DATABASE_URL).pathname !== "/student-mart") throw new Error("Requires student-mart");
  const source = new DataSource(databaseOptions(config)); await source.initialize();
  let failUpload = false, failDelete = false;
  const destroyed: string[] = [];
  const storage: ListingMediaStorage = {
    async upload(publicId, bytes) { if (failUpload) throw new Error("Provider unavailable"); expect((await sharp(bytes).metadata()).format).toBe("webp"); return { url: `https://cdn.example.invalid/${publicId}.webp` }; },
    async destroy(publicId) { if (failDelete) throw new Error("Delete unavailable"); destroyed.push(publicId); },
  };
  const app = await authApp(source, [], undefined, storage);
  const ids: string[] = [];
  const cleanup = async () => { await app.close(); try { if (ids.length) { await source.getRepository(ListingMedia).delete({ ownerId: In(ids) }); await source.getRepository(AuthSession).delete({ accountId: In(ids) }); await source.getRepository(Account).delete({ id: In(ids) }); } } finally { await source.destroy(); } };
  try {
    const service = new AccountsService(source.getRepository(Account));
    const people = [];
    for (const name of ["A", "B"]) { const a = await service.create({ email: `listing-media-${randomUUID()}@example.invalid`, password, displayName: `Media ${name}` }); ids.push(a.id); people.push(a); }
    await app.listen({ host: "127.0.0.1", port: 0 });
    const origin = await app.getUrl();
    const token = async (email: string) => { const r = await fetch(`${origin}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); expect(r.status).toBe(200); return (await r.json()).session.token as string; };
    const tokens = await Promise.all(people.map(a => token(a.email)));
    const png = await sharp({ create: { width: 3, height: 2, channels: 3, background: "#f57c20" } }).png().toBuffer();
    return { source, origin, ids, tokens, png, storage, destroyed, cleanup, setUploadFailure(v: boolean) { failUpload = v; }, setDeleteFailure(v: boolean) { failDelete = v; } };
  } catch (error) { await cleanup(); throw error; }
}
async function upload(origin: string, token: string, bytes: Buffer, mime = "image/png", query = "") {
  const body = new FormData(); body.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), "fixture.png");
  return fetch(`${origin}/api/v1/listing-media${query}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
}
const remove = (origin: string, token: string, id: string) => fetch(`${origin}/api/v1/listing-media/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });

it("validates real multipart files, isolates ownership, and preserves staged media on provider failure", async () => {
  const f = await fixture();
  try {
    const saved = await upload(f.origin, f.tokens[0], f.png, "image/png", `?ownerId=${f.ids[1]}`);
    expect(saved.status).toBe(201);
    expect(saved.headers.get("cache-control")).toBe("no-store");
    const { media } = await saved.json();
    expect(media).toMatchObject({ width: 3, height: 2 });
    expect(media.url).toMatch(/^https:/);
    expect(Object.keys(media).sort()).toEqual(["expiresAt", "height", "id", "url", "width"]);
    const repo = f.source.getRepository(ListingMedia);
    expect(await repo.findOneByOrFail({ id: media.id })).toMatchObject({ ownerId: f.ids[0], state: "STAGED", listingId: null });
    expect((await remove(f.origin, f.tokens[1], media.id)).status).toBe(404);
    expect((await upload(f.origin, f.tokens[0], Buffer.from("not an image"))).status).toBe(415);
    expect((await upload(f.origin, f.tokens[0], f.png, "image/jpeg")).status).toBe(415);
    const tooWide = await sharp({ create: { width: 12001, height: 1, channels: 3, background: "#fff" } }).png().toBuffer();
    expect((await upload(f.origin, f.tokens[0], tooWide)).status).toBe(415);
    expect((await upload(f.origin, f.tokens[0], Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
    f.setUploadFailure(true);
    expect((await upload(f.origin, f.tokens[0], f.png)).status).toBe(503);
    expect(await repo.findOneByOrFail({ id: media.id })).toMatchObject({ state: "STAGED", url: media.url });
    f.setUploadFailure(false);
    expect((await remove(f.origin, f.tokens[0], media.id)).status).toBe(204);
    expect((await remove(f.origin, f.tokens[0], media.id)).status).toBe(204);
    expect(await f.source.getRepository(Account).countBy({ id: In(f.ids) })).toBe(2);
    expect(f.destroyed.length).toBeGreaterThan(0);
  } finally { await f.cleanup(); }
}, 30000);

it("enforces the per-account pending quota without blocking a different owner", async () => {
  const f = await fixture();
  try {
    const repo = f.source.getRepository(ListingMedia);
    const rows = await repo.save(Array.from({ length: 32 }, () => repo.create({ ownerId: f.ids[0], state: "STAGED", publicId: `fixture-only/${randomUUID()}`, url: "https://cdn.example.invalid/fixture.webp", width: 3, height: 2, expiresAt: new Date(Date.now() + 3600000), listingId: null })));
    const response = await upload(f.origin, f.tokens[0], f.png);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(await repo.countBy({ ownerId: f.ids[0] })).toBe(32);
    expect((await upload(f.origin, f.tokens[1], f.png)).status).toBe(201);
    await repo.delete(rows[0].id);
    expect((await upload(f.origin, f.tokens[0], f.png)).status).toBe(201);
  } finally { await f.cleanup(); }
}, 30000);

it("keeps attachment boundaries atomic and retries expired-media cleanup without touching linked media", async () => {
  const f = await fixture();
  try {
    const repo = f.source.getRepository(ListingMedia), service = new ListingMediaService(f.source, f.storage);
    const first = (await (await upload(f.origin, f.tokens[0], f.png)).json()).media;
    const second = (await (await upload(f.origin, f.tokens[0], f.png)).json()).media;
    const foreign = (await (await upload(f.origin, f.tokens[1], f.png)).json()).media;
    const listingId = randomUUID(); // Only a future integration-port reference, not a persisted Listing fixture.
    await expect(f.source.transaction(m => service.attach(m, f.ids[0], [first.id, foreign.id], listingId))).rejects.toThrow();
    expect((await repo.findOneByOrFail({ id: first.id })).state).toBe("STAGED");
    await f.source.transaction(m => service.attach(m, f.ids[0], [first.id], listingId));
    expect((await remove(f.origin, f.tokens[0], first.id)).status).toBe(409);
    await repo.update(second.id, { expiresAt: new Date(Date.now() - 1000) });
    await expect(f.source.transaction(m => service.attach(m, f.ids[0], [second.id], listingId))).rejects.toThrow();
    f.setDeleteFailure(true);
    expect((await remove(f.origin, f.tokens[0], second.id)).status).toBe(204);
    expect((await repo.findOneByOrFail({ id: second.id })).state).toBe("DELETING");
    expect((await repo.findOneByOrFail({ id: first.id })).state).toBe("ATTACHED");
    f.setDeleteFailure(false); await service.cleanupOne(second.id);
    expect((await repo.findOneByOrFail({ id: second.id })).state).toBe("DELETED");
    expect((await repo.findOneByOrFail({ id: first.id })).listingId).toBe(listingId);
  } finally { await f.cleanup(); }
}, 30000);

it("runs the production mobile media model through HTTP with cancel, retry, reordering and account cleanup", async () => {
  const f = await fixture();
  const api = createAuthApi(f.origin);
  let record: import("../../../mobile/src/features/auth/business/auth").Credential | null = null;
  const auth = createAuthCoordinator(api, { async read() { return record; }, async write(v) { record = v; }, async clear() { record = null; } });
  let cancel = true;
  let holdResponse = false;
  let release!: () => void, received!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { received = resolve; });
  const asset: ListingImageAsset = { uri: "memory://listing-fixture.png", name: "fixture.png", mimeType: "image/png", size: f.png.length, width: 3, height: 2 };
  // Node adapts a native URI to fixture bytes; production model and auth boundary are unchanged.
  const model = createListingMediaModel({
    upload: () => auth.runPrivate(async token => { const r = await upload(f.origin, token, f.png); if (!r.ok) throw new Error("Upload failed"); const media = (await r.json()).media; if (holdResponse) { received(); await gate; } return media; }),
    remove: id => auth.runPrivate(async token => { const r = await remove(f.origin, token, id); if (!r.ok) throw new Error("Delete failed"); }),
  }, auth, async () => cancel ? null : [asset, asset]);
  try {
    const person = await f.source.getRepository(Account).findOneByOrFail({ id: f.ids[0] });
    await auth.login({ email: person.email, password });
    await model.choose(); expect(model.getSnapshot().entries).toHaveLength(0);
    cancel = false; await model.choose();
    const [first, second] = model.getSnapshot().entries;
    f.setUploadFailure(true); await model.upload(first.key);
    expect(model.getSnapshot().entries[0]).toMatchObject({ status: "error", asset, media: null });
    f.setUploadFailure(false); await model.upload(first.key); await model.upload(second.key);
    const ids = model.confirmedIds(); expect(ids).toHaveLength(2);
    model.move(second.key, -1); expect(model.confirmedIds()).toEqual([...ids].reverse());
    await model.remove(first.key); expect(model.confirmedIds()).toEqual([ids[1]]);
    await model.choose(); holdResponse = true;
    const pending = model.upload(model.getSnapshot().entries[1].key);
    await arrived;
    await auth.endSession(); expect(model.getSnapshot().entries).toHaveLength(0);
    expect(record).toBeNull();
    const b = await f.source.getRepository(Account).findOneByOrFail({ id: f.ids[1] });
    await auth.login({ email: b.email, password });
    release(); await pending;
    expect(auth.getSnapshot().account?.id).toBe(b.id);
    expect(model.getSnapshot().entries).toHaveLength(0);
  } finally { release(); model.dispose(); await f.cleanup(); }
}, 30000);
