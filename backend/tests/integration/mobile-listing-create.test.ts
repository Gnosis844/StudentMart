import "reflect-metadata";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource, In } from "typeorm";
import { expect, it } from "vitest";
import { Account } from "../../src/modules/accounts/business/account.entity";
import { AccountsService } from "../../src/modules/accounts/business/accounts.service";
import { AuthSession } from "../../src/modules/auth/business/auth-session.entity";
import { Area } from "../../src/modules/accounts/business/catalog.entity";
import { ListingMedia } from "../../src/modules/listings/business/listing-media.entity";
import { loadConfig } from "../../src/shared/config/env";
import { databaseOptions } from "../../src/shared/database/database-options";
import { authApp } from "../support/auth-app";
import { createAuthApi } from "../../../mobile/src/features/auth/data/auth-api";
import { createAuthCoordinator } from "../../../mobile/src/features/auth/business/auth-coordinator";
import type { Credential } from "../../../mobile/src/features/auth/business/auth";
import { createListingCreateModel } from "../../../mobile/src/features/listings/business/listing-create-model";
import { createListingCreateRepository } from "../../../mobile/src/features/listings/data/listing-create-repository";

const password = "listing-create-qa-password";
async function fixture() {
  const config = loadConfig();
  if (!config.DATABASE_URL || new URL(config.DATABASE_URL).pathname !== "/student-mart") throw new Error("Requires student-mart");
  const source = new DataSource(databaseOptions(config)); await source.initialize();
  const app = await authApp(source); const ids: string[] = []; const catalogId = randomUUID(), areaId = randomUUID();
  const cleanup = async () => {
    await app.close();
    try {
      // Only UUID-scoped fixtures created by this test are removed; never reset user data.
      if (ids.length) {
        await source.query('DELETE FROM "ListingImage" WHERE "listingId" IN (SELECT id FROM "Listing" WHERE "ownerId" = ANY($1::uuid[]))', [ids]);
        await source.query('DELETE FROM "ListingMutation" WHERE "actorId" = ANY($1::uuid[])', [ids]);
        await source.getRepository(ListingMedia).update({ ownerId: In(ids) }, { listingId: null, state: "STAGED" });
        await source.query('DELETE FROM "Listing" WHERE "ownerId" = ANY($1::uuid[])', [ids]);
        await source.getRepository(ListingMedia).delete({ ownerId: In(ids) });
        await source.getRepository(AuthSession).delete({ accountId: In(ids) });
        await source.getRepository(Account).delete({ id: In(ids) });
      }
      await source.query('DELETE FROM "ListingCategory" WHERE id=$1', [catalogId]);
      await source.getRepository(Area).delete(areaId);
    } finally { await source.destroy(); }
  };
  try {
    const accounts = new AccountsService(source.getRepository(Account)); const people = [];
    for (const label of ["A", "B"]) { const a = await accounts.create({ email: `listing-create-${randomUUID()}@example.invalid`, displayName: `QA ${label}`, password }); ids.push(a.id); people.push(a); }
    await source.getRepository(Area).save({ id: areaId, code: `qa-${randomUUID()}`, name: "Synthetic QA area" });
    await source.query('INSERT INTO "ListingCategory" (id,code,name) VALUES ($1,$2,$3)', [catalogId, `qa-${randomUUID()}`, "Synthetic QA category"]);
    await app.listen({ host: "127.0.0.1", port: 0 }); const origin = await app.getUrl();
    const login = async (index: number) => { const response = await fetch(`${origin}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: people[index].email, password }) }); expect(response.status).toBe(200); return (await response.json()).session.token as string; };
    const tokens = await Promise.all([login(0), login(1)]);
    const post = (body: unknown, key = randomUUID(), index = 0) => fetch(`${origin}/api/v1/listings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[index]}`, "Idempotency-Key": key }, body: JSON.stringify(body) });
    const common = { title: "Synthetic listing fixture", description: "Synthetic QA fixture only", categoryId: catalogId, areaId };
    const media = async (owner = 0) => source.getRepository(ListingMedia).save(source.getRepository(ListingMedia).create({ ownerId: ids[owner], state: "STAGED", publicId: `fixture-only/${randomUUID()}`, url: "https://cdn.example.invalid/fixture.webp", width: 3, height: 2, expiresAt: new Date(Date.now() + 3600000), listingId: null }));
    const get = (path: string, index = 0) => fetch(`${origin}/api/v1${path}`, { headers: { Authorization: `Bearer ${tokens[index]}` } });
    return { source, app, ids, people, tokens, origin, common, post, media, get, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

it("creates all three types with server identity, persisted media and truthful nullable BUY budget", async () => {
  const f = await fixture();
  try {
    const sellImage = await f.media(), exchangeImage = await f.media();
    const payloads = [
      { ...f.common, type: "SELL", price: 120000, condition: "USED_GOOD", mediaIds: [sellImage.id] },
      { ...f.common, type: "BUY", description: "😀".repeat(5000), budget: null, mediaIds: [] },
      { ...f.common, type: "EXCHANGE", condition: "USED_FAIR", exchangeWanted: "Synthetic books wanted", mediaIds: [exchangeImage.id] },
    ];
    for (const payload of payloads) {
      const response = await f.post(payload); expect(response.status).toBe(201);
      if (payload.type === "BUY") expect(Buffer.byteLength(JSON.stringify(payload), "utf8")).toBeGreaterThan(16384);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const result = await response.json(); expect(result.listing).toMatchObject({ type: payload.type, owner: { id: f.ids[0] }, version: 1 });
      expect(JSON.stringify(result)).not.toMatch(/password|token|publicId|email/);
      const reopened = await f.get(`/me/listings/${result.listing.id}`); expect(reopened.status).toBe(200);
      expect((await reopened.json()).listing).toMatchObject({ id: result.listing.id, type: payload.type });
      expect((await f.get(`/me/listings/${result.listing.id}`, 1)).status).toBe(404);
      if (payload.type === "BUY") expect(result.listing.budget).toBeNull();
    }
    expect(await f.source.getRepository(ListingMedia).findOneByOrFail({ id: sellImage.id })).toMatchObject({ state: "ATTACHED" });
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(3);
  } finally { await f.cleanup(); }
}, 30000);

it("reconciles a real lost create acknowledgement through the production mobile model without creating a second listing", async () => {
  const f = await fixture();
  let record: Credential | null = null;
  const auth = createAuthCoordinator(createAuthApi(f.origin), { async read() { return record; }, async write(value) { record = value; }, async clear() { record = null; } });
  let model: ReturnType<typeof createListingCreateModel> | undefined;
  try {
    await auth.login({ email: f.people[0].email, password });
    let loseAcknowledgement = true, newKeys = 0;
    const request: typeof fetch = async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST" && String(url).endsWith("/listings") && response.status === 201 && loseAcknowledgement) {
        loseAcknowledgement = false; await response.arrayBuffer(); throw new TypeError("Synthetic lost ACK after real server commit");
      }
      return response;
    };
    model = createListingCreateModel(createListingCreateRepository(f.origin, auth, request), auth, { confirmedIds: () => [], reset() {} }, () => { newKeys++; return randomUUID(); });
    await model.loadCatalog();
    model.set("type", "BUY"); model.set("title", f.common.title); model.set("description", f.common.description); model.set("categoryId", f.common.categoryId); model.set("areaId", f.common.areaId);
    await model.submit();
    expect(model.getSnapshot()).toMatchObject({ uncertain: true, listing: null, draft: { title: f.common.title } });
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(1);
    await model.submit();
    expect(model.getSnapshot()).toMatchObject({ uncertain: false, listing: { type: "BUY", owner: { id: f.ids[0] } } });
    expect(newKeys).toBe(1);
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(1);
    await auth.endSession(); await auth.login({ email: f.people[1].email, password });
    expect(model.getSnapshot()).toMatchObject({ listing: null, uncertain: false, draft: { title: "" } });
  } finally { model?.dispose(); await f.cleanup(); }
}, 30000);

it("keeps create retries canonical and concurrent-safe, and reconciles only the actor's durable outcome", async () => {
  const f = await fixture();
  try {
    const body = { ...f.common, type: "BUY", budget: null, mediaIds: [] }; const key = randomUUID();
    const replies = await Promise.all([f.post(body, key), f.post(body, key)]);
    expect(replies.some(r => r.status === 201)).toBe(true); expect(replies.every(r => [201, 409].includes(r.status))).toBe(true);
    // Reverse property order to prove canonical hashing is not raw JSON text hashing.
    const reversed = Object.fromEntries(Object.entries(body).reverse());
    const replay = await f.post(reversed, key); expect(replay.status).toBe(201); expect(replay.headers.get("idempotency-replayed")).toBe("true");
    const listing = (await replay.json()).listing;
    expect((await f.post({ ...body, title: "A changed synthetic title" }, key)).status).toBe(409);
    const known = await f.get(`/me/listing-submissions/${key}`); expect(known.status).toBe(200);
    expect(JSON.stringify(await known.json())).toContain(listing.id);
    expect((await f.get(`/me/listing-submissions/${key}`, 1)).status).toBe(404);
    expect((await f.get(`/me/listing-submissions/${randomUUID()}`)).status).toBe(404);
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(1);
    await f.source.query('UPDATE "ListingMutation" SET "replayUntil"=$1 WHERE "actorId"=$2 AND key=$3', [new Date(Date.now() - 1000), f.ids[0], key]);
    expect((await f.post(body, key)).status).toBe(410);
    const expired = await f.get(`/me/listing-submissions/${key}`); expect(expired.status).toBe(200);
    expect((await expired.json()).submission).toMatchObject({ state: "EXPIRED", listingId: listing.id });
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(1);
  } finally { await f.cleanup(); }
}, 30000);

it("rejects privilege injection, missing ownership and invalid lookup without attaching media or persisting partial listings", async () => {
  const f = await fixture();
  try {
    const own = await f.media(), other = await f.media(1);
    const base = { ...f.common, type: "SELL", price: 1, condition: "USED_GOOD", mediaIds: [own.id] };
    for (const extra of [{ ownerId: f.ids[1] }, { role: "ADMIN" }, { status: "OPEN" }]) expect((await f.post({ ...base, ...extra })).status).toBe(400);
    const failedKey = randomUUID(), invalidArea = { ...base, areaId: randomUUID() };
    expect((await f.post(invalidArea, failedKey)).status).toBe(400);
    expect((await f.post(invalidArea, failedKey)).status).toBe(400);
    const failure = await f.get(`/me/listing-submissions/${failedKey}`);
    expect(failure.status).toBe(200);
    expect((await failure.json()).submission).toMatchObject({ state: "FAILED", listingId: null, errorCode: "VALIDATION_ERROR" });
    expect((await f.post({ ...base, mediaIds: [other.id] })).status).toBe(409);
    expect((await f.post({ ...base, mediaIds: [] })).status).toBe(400);
    expect(await f.source.getRepository(ListingMedia).findOneByOrFail({ id: own.id })).toMatchObject({ state: "STAGED", listingId: null });
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(0);
    const expired = await f.media(); await f.source.getRepository(ListingMedia).update(expired.id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await f.post({ ...base, mediaIds: [expired.id] })).status).toBe(409);
    expect((await fetch(`${f.origin}/api/v1/listings`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(base) })).status).toBe(401);
    await f.source.getRepository(Account).update(f.ids[0], { loginDisabledAt: new Date() });
    expect((await f.post(base)).status).toBe(403);
    await f.source.getRepository(Account).update(f.ids[0], { loginDisabledAt: null });
    await f.source.getRepository(AuthSession).update({ accountId: f.ids[0] }, { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 2000) });
    const expiredSession = await f.post(base); expect(expiredSession.status).toBe(401);
    expect((await expiredSession.json()).error.code).toBe("SESSION_EXPIRED");
  } finally { await f.cleanup(); }
}, 30000);

it("ignores a real account A create response delivered after logout and login B", async () => {
  const f = await fixture(); let record: Credential | null = null;
  const auth = createAuthCoordinator(createAuthApi(f.origin), { async read() { return record; }, async write(value) { record = value; }, async clear() { record = null; } });
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const received = new Promise<void>(resolve => { arrived = resolve; });
  let model: ReturnType<typeof createListingCreateModel> | undefined;
  try {
    await auth.login({ email: f.people[0].email, password });
    const request: typeof fetch = async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST" && String(url).endsWith("/listings") && response.status === 201) {
        const bytes = await response.arrayBuffer(); arrived(); await gate;
        return new Response(bytes, { status: response.status, headers: response.headers });
      }
      return response;
    };
    model = createListingCreateModel(createListingCreateRepository(f.origin, auth, request), auth, { confirmedIds: () => [], reset() {} }, randomUUID);
    await model.loadCatalog(); model.set("type", "BUY"); model.set("title", f.common.title); model.set("description", f.common.description); model.set("categoryId", f.common.categoryId); model.set("areaId", f.common.areaId);
    const pending = model.submit(); await received;
    await auth.endSession(); await auth.login({ email: f.people[1].email, password });
    release(); await pending;
    expect(auth.getSnapshot().account?.id).toBe(f.ids[1]);
    expect(model.getSnapshot()).toMatchObject({ listing: null, uncertain: false, draft: { title: "" } });
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[0]])).length).toBe(1);
    expect((await f.source.query('SELECT id FROM "Listing" WHERE "ownerId"=$1', [f.ids[1]])).length).toBe(0);
  } finally { release(); model?.dispose(); await f.cleanup(); }
}, 30000);
