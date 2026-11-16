import "reflect-metadata";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { expect, it } from "vitest";
import { Account } from "../../src/modules/accounts/business/account.entity";
import { AccountsService } from "../../src/modules/accounts/business/accounts.service";
import { AuthSession } from "../../src/modules/auth/business/auth-session.entity";
import { loadConfig } from "../../src/shared/config/env";
import { databaseOptions } from "../../src/shared/database/database-options";
import { authApp } from "../support/auth-app";

it("serves real Vietnamese catalogs to guests and accepts their IDs for a persisted listing", async () => {
  const config = loadConfig();
  if (!config.DATABASE_URL || new URL(config.DATABASE_URL).pathname !== "/student-mart") throw new Error("Requires student-mart");
  const source = new DataSource(databaseOptions(config)); await source.initialize();
  const app = await authApp(source);
  let accountId: string | undefined;
  try {
    const categoriesResponse = await app.inject({ method: "GET", url: "/api/v1/catalog/listing-categories" });
    const areasResponse = await app.inject({ method: "GET", url: "/api/v1/catalog/areas" });
    expect(categoriesResponse.statusCode).toBe(200); expect(areasResponse.statusCode).toBe(200);
    const categories = categoriesResponse.json().items as { id: string; code: string; name: string }[];
    const areas = areasResponse.json().items as { id: string; code: string; name: string }[];
    expect(categories.length).toBeGreaterThanOrEqual(16); expect(areas.length).toBeGreaterThanOrEqual(10);
    for (const items of [categories, areas]) {
      expect(new Set(items.map(item => item.code)).size).toBe(items.length);
      for (const item of items) expect(Object.keys(item).sort()).toEqual(["code", "id", "name"]);
    }
    const category = categories.find(item => /giáo trình/i.test(item.name));
    const area = areas.find(item => /ký túc xá.*khu a/i.test(item.name));
    expect(category).toBeDefined(); expect(area).toBeDefined();
    expect(areas.some(item => /bách khoa/i.test(item.name))).toBe(true);
    expect(areas.some(item => /khoa học tự nhiên/i.test(item.name))).toBe(true);
    const before = await source.query('SELECT id,code,name FROM "Area" WHERE id=$1', [area!.id]);
    const password = "catalog-qa-fixture-password";
    const account = await new AccountsService(source.getRepository(Account)).create({ email: `catalog-${randomUUID()}@example.invalid`, password, displayName: "Catalog QA fixture" });
    accountId = account.id;
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: account.email, password } });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().session.token}` };
    const created = await app.inject({ method: "POST", url: "/api/v1/listings", headers: { ...headers, "idempotency-key": randomUUID() }, payload: { type: "BUY", title: "Cần tìm giáo trình cho học kỳ", description: "Test fixture using real catalog IDs", categoryId: category!.id, areaId: area!.id, budget: null, mediaIds: [] } });
    expect(created.statusCode).toBe(201);
    expect(created.json().listing).toMatchObject({ category: { id: category!.id, name: category!.name }, area: { id: area!.id, name: area!.name }, budget: null });
    const reopened = await app.inject({ method: "GET", url: `/api/v1/me/listings/${created.json().listing.id}`, headers });
    expect(reopened.statusCode).toBe(200);
    const profile = await app.inject({ method: "PATCH", url: "/api/v1/accounts/me", headers, payload: { areaId: area!.id } });
    expect(profile.statusCode).toBe(200); expect(profile.json().account.area.id).toBe(area!.id);
    expect(await source.query('SELECT id,code,name FROM "Area" WHERE id=$1', [area!.id])).toEqual(before);
  } finally {
    await app.close();
    try {
      if (accountId) {
        await source.query('DELETE FROM "ListingMutation" WHERE "actorId"=$1', [accountId]);
        await source.query('DELETE FROM "Listing" WHERE "ownerId"=$1', [accountId]);
        await source.getRepository(AuthSession).delete({ accountId });
        await source.getRepository(Account).delete(accountId);
      }
    } finally { await source.destroy(); }
  }
}, 30000);
