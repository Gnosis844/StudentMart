import { AuthError } from "../../auth/business/auth";
export type ListingType = "SELL" | "BUY" | "EXCHANGE";
export type ListingCondition = "USED_GOOD" | "USED_FAIR" | "NEEDS_REPAIR";
export type ListingLookup = { id: string; name: string };
type Common = { type: ListingType; title: string; description: string; categoryId: string; areaId: string; mediaIds: string[] };
export type CreateListingInput = Common & ({ type: "SELL"; condition: ListingCondition; price: number } | { type: "BUY"; budget: number | null } | { type: "EXCHANGE"; condition: ListingCondition; exchangeWanted: string });
export type OwnListing = { id: string; type: ListingType; title: string; description: string; version: number; category: ListingLookup; area: ListingLookup; images: { id: string; url: string; width: number; height: number }[]; owner: { id: string; displayName: string; avatarUrl: string | null }; lifecycle: { status: string }; price?: number; budget?: number | null; exchangeWanted?: string };
export type ListingSubmission = { key: string; state: "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED"; listingId: string | null; errorCode: string | null };
export type ListingCreateRepository = { catalog(): Promise<{ categories: ListingLookup[]; areas: ListingLookup[] }>; create(input: CreateListingInput, key: string): Promise<OwnListing>; submission(key: string): Promise<ListingSubmission | null>; get(id: string): Promise<OwnListing> };
export type ListingDraft = { type: ListingType; title: string; description: string; categoryId: string; areaId: string; condition: ListingCondition; amount: string; exchangeWanted: string };
export const emptyListingDraft = (): ListingDraft => ({ type: "SELL", title: "", description: "", categoryId: "", areaId: "", condition: "USED_GOOD", amount: "", exchangeWanted: "" });
export function listingDraftErrors(d: ListingDraft) {
  const errors: Partial<Record<keyof ListingDraft, string>> = {};
  const length = (v: string) => Array.from(v.trim()).length;
  if (length(d.title) < 10 || length(d.title) > 120) errors.title = "Tiêu đề cần từ 10 đến 120 ký tự.";
  if (length(d.description) < 1 || length(d.description) > 5000) errors.description = "Mô tả cần từ 1 đến 5000 ký tự.";
  if (!d.categoryId) errors.categoryId = "Chọn danh mục được hỗ trợ.";
  if (!d.areaId) errors.areaId = "Chọn khu vực được hỗ trợ.";
  if (d.type === "EXCHANGE" && (length(d.exchangeWanted) < 1 || length(d.exchangeWanted) > 2000)) errors.exchangeWanted = "Mô tả món hoặc điều kiện muốn đổi (tối đa 2000 ký tự).";
  if (d.type !== "EXCHANGE" && !(d.type === "BUY" && !d.amount.trim()) && (!/^\d+$/.test(d.amount.trim()) || Number(d.amount) > 1000000000)) errors.amount = "Nhập số nguyên VND từ 0 đến 1.000.000.000.";
  return errors;
}
export function listingInput(d: ListingDraft, mediaIds: string[]): CreateListingInput {
  if (Object.keys(listingDraftErrors(d)).length || mediaIds.length > 8 || (d.type !== "BUY" && mediaIds.length < 1)) throw new AuthError("VALIDATION_ERROR", "Kiểm tra thông tin và ảnh bắt buộc trước khi đăng tin.");
  const common = { title: d.title.trim(), description: d.description.trim(), categoryId: d.categoryId, areaId: d.areaId, mediaIds: [...mediaIds] };
  if (d.type === "SELL") return { ...common, type: "SELL", condition: d.condition, price: Number(d.amount) };
  if (d.type === "BUY") return { ...common, type: "BUY", budget: d.amount.trim() ? Number(d.amount) : null };
  return { ...common, type: "EXCHANGE", condition: d.condition, exchangeWanted: d.exchangeWanted.trim() };
}
