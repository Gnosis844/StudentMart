import { AuthError } from "../../auth/business/auth";
import type { AuthCoordinator } from "../../auth/business/auth-coordinator";
import { emptyListingDraft, listingDraftErrors, listingInput, type ListingCreateRepository, type ListingDraft, type ListingLookup, type OwnListing, type CreateListingInput } from "./listing-create";
export function createListingCreateModel(repository: ListingCreateRepository, auth: AuthCoordinator, media: { confirmedIds(): string[]; reset(): void }, newKey: () => string) {
  let state = { draft: emptyListingDraft(), categories: [] as ListingLookup[], areas: [] as ListingLookup[], catalogStatus: "idle" as "idle" | "loading" | "ready" | "error", busy: false, uncertain: false, message: "", listing: null as OwnListing | null };
  let attempt: { key: string; input: CreateListingInput } | null = null, generation = 0;
  let owner = auth.getSnapshot(); const listeners = new Set<() => void>();
  const update = (next: Partial<typeof state>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };
  const reset = () => { generation++; attempt = null; update({ draft: emptyListingDraft(), busy: false, uncertain: false, listing: null, message: "", categories: [], areas: [], catalogStatus: "idle" }); };
  const unsubscribe = auth.subscribe(() => { const next = auth.getSnapshot(); if (next.epoch !== owner.epoch || next.account?.id !== owner.account?.id || next.status !== "authenticated") reset(); owner = next; });
  const current = (n: number) => n === generation && auth.getSnapshot().status === "authenticated";
  const confirm = (listing: OwnListing) => { if (listing.owner.id !== auth.getSnapshot().account?.id) throw new AuthError("IDENTITY_MISMATCH", "Không xác nhận được đúng chủ tin."); media.reset(); attempt = null; update({ listing, uncertain: false, message: "Đã đăng tin. Máy chủ đã xác nhận lưu." }); };
  return {
    getSnapshot: () => state, subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }, reset,
    errors: () => listingDraftErrors(state.draft),
    dirty: () => !!attempt || Object.entries(state.draft).some(([key, value]) => value !== emptyListingDraft()[key as keyof ListingDraft]),
    set<K extends keyof ListingDraft>(field: K, value: ListingDraft[K]) { if (state.busy || state.uncertain || state.listing) return; attempt = null; update({ draft: { ...state.draft, [field]: value }, message: "" }); },
    async loadCatalog() { if (state.catalogStatus === "loading") return; const n = generation; update({ catalogStatus: "loading", message: "" }); try { const c = await repository.catalog(); if (current(n)) update({ ...c, catalogStatus: "ready" }); } catch { if (current(n)) update({ catalogStatus: "error", message: "Chưa tải được danh mục hoặc khu vực. Vui lòng thử lại." }); } },
    async submit() {
      if (state.busy || state.listing) return;
      const n = generation; update({ busy: true, message: "" });
      try {
        if (state.uncertain && attempt) {
          const result = await repository.submission(attempt.key);
          if (!current(n)) return;
          if (result?.listingId) { const listing = await repository.get(result.listingId); if (current(n)) confirm(listing); return; }
          if (result?.state === "PROCESSING") { update({ message: "Máy chủ đang xử lý lần đăng trước. Chưa tạo lần đăng mới." }); return; }
          if (result?.state === "EXPIRED") { update({ message: "Lần đăng trước đã hết thời gian đối chiếu. Chưa thể xác định kết quả; không tự tạo tin mới. Vui lòng liên hệ hỗ trợ." }); return; }
          if (result?.state === "FAILED") { attempt = null; update({ uncertain: false, message: "Máy chủ xác nhận lần đăng trước thất bại. Bạn có thể kiểm tra thông tin rồi đăng lại." }); return; }
          // Unknown can be an in-flight admission. Retry the SAME key and exact saved payload.
        }
        if (!attempt) {
          const input = listingInput(state.draft, media.confirmedIds());
          if (!state.categories.some(c => c.id === input.categoryId) || !state.areas.some(a => a.id === input.areaId)) throw new AuthError("VALIDATION_ERROR", "Danh mục hoặc khu vực chưa được xác nhận. Hãy tải lại danh sách.");
          attempt = { key: newKey(), input };
        }
        update({ uncertain: true });
        const listing = await repository.create(attempt.input, attempt.key);
        if (current(n)) confirm(listing);
      } catch (error) {
        if (!current(n)) return;
        const code = error instanceof AuthError ? error.code : "NETWORK_ERROR";
        if (["VALIDATION_ERROR", "MEDIA_UNAVAILABLE"].includes(code)) { attempt = null; update({ uncertain: false }); }
        update({ message: error instanceof AuthError ? error.message : "Chưa xác nhận được kết quả đăng tin. Giữ nguyên nội dung và đối chiếu lần gửi trước khi thử lại." });
      } finally { if (current(n)) update({ busy: false }); }
    },
    dispose() { reset(); unsubscribe(); listeners.clear(); },
  };
}
export type ListingCreateModel = ReturnType<typeof createListingCreateModel>;
