import { expect, it } from "vitest";
import { createListingSchema } from "../../src/modules/listings/presentation/listing-validation";
const common = { title: "A valid item title", description: "Real description", categoryId: "11111111-1111-4111-8111-111111111111", areaId: "22222222-2222-4222-8222-222222222222" };
it("allows BUY with explicit null budget and no owned item photos", () => { expect(createListingSchema.parse({ ...common, type: "BUY", budget: null, mediaIds: [] })).toMatchObject({ budget: null, mediaIds: [] }); });
it("requires photo IDs for SELL/EXCHANGE and their specific fields", () => { expect(createListingSchema.safeParse({ ...common, type: "SELL", price: 0, condition: "USED_GOOD", mediaIds: [] }).success).toBe(false); expect(createListingSchema.safeParse({ ...common, type: "EXCHANGE", condition: "USED_GOOD", mediaIds: [common.areaId] }).success).toBe(false); });
it("rejects privilege, state and cross-type injection", () => { for (const field of ["ownerId", "role", "status", "price"]) {
    expect(createListingSchema.safeParse({ ...common, type: "BUY", budget: null, mediaIds: [], [field]: field === "price" ? 0 : "bad" }).success).toBe(false);
} });
it("counts normalized Unicode code points rather than UTF16 and keeps null separate from zero", () => { const emoji = String.fromCodePoint(0x1f600); const v = { ...common, type: "BUY", budget: 0, mediaIds: [], title: emoji.repeat(120), description: emoji.repeat(5000) }; expect(createListingSchema.safeParse(v).success).toBe(true); expect(createListingSchema.safeParse({ ...v, title: v.title + emoji }).success).toBe(false); expect(createListingSchema.safeParse({ ...v, budget: 0.1 }).success).toBe(false); });
