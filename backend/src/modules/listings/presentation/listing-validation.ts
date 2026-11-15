import { z } from "zod";
const text = (min: number, max: number) => z.string().trim().refine(v => Array.from(v).length >= min && Array.from(v).length <= max);
const ids = z.array(z.string().uuid().transform(v => v.toLowerCase())).max(8).refine(a => new Set(a).size === a.length);
const common = { title: text(10, 120), description: text(1, 5000), categoryId: z.string().uuid().transform(v => v.toLowerCase()), areaId: z.string().uuid().transform(v => v.toLowerCase()) };
const condition = z.enum(["USED_GOOD", "USED_FAIR", "NEEDS_REPAIR"]);
const money = z.number().int().min(0).max(1000000000);
export const createListingSchema = z.discriminatedUnion("type", [
    z.strictObject({ ...common, type: z.literal("SELL"), condition, price: money, mediaIds: ids.refine(a => a.length >= 1) }),
    z.strictObject({ ...common, type: z.literal("BUY"), budget: money.nullable(), mediaIds: ids }),
    z.strictObject({ ...common, type: z.literal("EXCHANGE"), condition, exchangeWanted: text(1, 2000), mediaIds: ids.refine(a => a.length >= 1) })
]);
export type CreateListingInput = z.output<typeof createListingSchema>;
export const listingUuid = z.string().uuid().transform(v => v.toLowerCase());
