import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { expect, it } from "vitest";
import { loadConfig } from "../../src/shared/config/env";
import { databaseOptions } from "../../src/shared/database/database-options";
import {
  initialListingCategories,
  initialMarketplaceAreas,
  SeedStudentMarketplaceCatalog1794720000000,
} from "../../src/shared/database/migrations/1794720000000-SeedStudentMarketplaceCatalog";

it("catalog data seed can repeat without overwriting existing IDs/names or enabling destructive rollback", async () => {
  const config = loadConfig();
  if (!config.DATABASE_URL || new URL(config.DATABASE_URL).pathname !== "/student-mart") throw new Error("Requires student-mart");
  const source = new DataSource(databaseOptions(config));
  await source.initialize();
  const runner = source.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    const categoryCodes = initialListingCategories.map(([code]) => code);
    const areaCodes = initialMarketplaceAreas.map(([code]) => code);
    const categories = await runner.query('SELECT id, code, name FROM "ListingCategory" WHERE code = ANY($1::text[]) ORDER BY code', [categoryCodes]);
    const areas = await runner.query('SELECT id, code, name FROM "Area" WHERE code = ANY($1::text[]) ORDER BY code', [areaCodes]);
    expect(categories).toHaveLength(16);
    expect(areas).toHaveLength(10);
    // This uncommitted edit simulates an existing operator-managed label. No other
    // connection observes it; finally always rolls it back. No migration history
    // or global schema is changed by the test.
    await runner.query('UPDATE "ListingCategory" SET name = $1 WHERE code = $2', ["Existing managed name", "BOOKS"]);
    const before = await runner.query('SELECT id, code, name FROM "ListingCategory" WHERE code = ANY($1::text[]) ORDER BY code', [categoryCodes]);
    const migration = new SeedStudentMarketplaceCatalog1794720000000();
    await migration.up(runner);
    await migration.up(runner);
    expect(await runner.query('SELECT id, code, name FROM "ListingCategory" WHERE code = ANY($1::text[]) ORDER BY code', [categoryCodes])).toEqual(before);
    expect(await runner.query('SELECT id, code, name FROM "Area" WHERE code = ANY($1::text[]) ORDER BY code', [areaCodes])).toEqual(areas);
    await expect(migration.down()).rejects.toThrow("forward-only");
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await source.destroy();
  }
}, 30000);
