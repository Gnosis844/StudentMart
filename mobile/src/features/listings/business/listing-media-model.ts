import { AuthError } from "../../auth/business/auth";
import type { AuthCoordinator } from "../../auth/business/auth-coordinator";
import { imageError, MAX_LISTING_IMAGES, type ListingImageAsset, type ListingMedia, type ListingMediaRepository } from "./listing-media";
export type ListingImageEntry = { key: string; asset: ListingImageAsset; status: "local" | "uploading" | "confirmed" | "error"; media: ListingMedia | null; error: string };
export function createListingMediaModel(repository: ListingMediaRepository, auth: AuthCoordinator, pick: (remaining: number) => Promise<ListingImageAsset[] | null>, now = Date.now) {
  let state = { entries: [] as ListingImageEntry[], busy: false, message: "" }, generation = 0, sequence = 0;
  let owner = auth.getSnapshot(); const listeners = new Set<() => void>();
  const update = (next: Partial<typeof state>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };
  const reset = () => { generation++; update({ entries: [], busy: false, message: "" }); };
  const unsubscribe = auth.subscribe(() => { const next = auth.getSnapshot(); if (next.epoch !== owner.epoch || next.account?.id !== owner.account?.id || next.status !== "authenticated") reset(); owner = next; });
  const current = (n: number) => generation === n && auth.getSnapshot().status === "authenticated";
  const requireOwner = () => { if (auth.getSnapshot().status !== "authenticated") throw new AuthError("UNAUTHENTICATED", "Đăng nhập để chuẩn bị ảnh."); };
  return { getSnapshot: () => state, subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }, reset,
    async choose() {
      if (state.busy) return; requireOwner(); const remaining = MAX_LISTING_IMAGES - state.entries.length;
      if (!remaining) { update({ message: "Bạn đã chọn đủ 8 ảnh." }); return; }
      const n = generation; update({ busy: true, message: "" });
      try { const assets = await pick(remaining); if (!current(n) || !assets) return;
        if (assets.length > remaining) { update({ message: "Tối đa 8 ảnh. Hãy chọn lại ít ảnh hơn." }); return; }
        const entries = assets.map(asset => { const error = imageError(asset); return { key: String(++sequence), asset, status: error ? "error" as const : "local" as const, media: null, error: error ?? "" }; });
        update({ entries: [...state.entries, ...entries] });
      } catch { if (current(n)) update({ message: "Chưa mở được thư viện ảnh. Kiểm tra quyền truy cập ảnh trong cài đặt thiết bị." }); }
      finally { if (current(n)) update({ busy: false }); }
    },
    async upload(key: string) {
      if (state.busy) return; requireOwner(); const entry = state.entries.find(e => e.key === key); if (!entry) return;
      if (entry.media && Date.parse(entry.media.expiresAt) > now()) return;
      const invalid = imageError(entry.asset); if (invalid) { update({ message: invalid }); return; }
      const n = generation; update({ busy: true, message: "", entries: state.entries.map(e => e.key === key ? { ...e, status: "uploading", error: "" } : e) });
      try { const media = await repository.upload(entry.asset); if (current(n)) update({ entries: state.entries.map(e => e.key === key ? { ...e, media, status: "confirmed", error: "" } : e) }); }
      catch (error) { if (current(n)) update({ entries: state.entries.map(e => e.key === key ? { ...e, status: "error", error: error instanceof AuthError ? error.message : "Chưa tải được ảnh. Ảnh đã chọn vẫn được giữ để thử lại." } : e) }); }
      finally { if (current(n)) update({ busy: false }); }
    },
    async remove(key: string) {
      if (state.busy) return; requireOwner(); const entry = state.entries.find(e => e.key === key); if (!entry) return;
      const n = generation; update({ busy: true, message: "" });
      try { if (entry.media) await repository.remove(entry.media.id); if (current(n)) update({ entries: state.entries.filter(e => e.key !== key) }); }
      catch (error) { if (current(n)) update({ message: error instanceof AuthError ? error.message : "Chưa xóa được ảnh. Ảnh hiện tại được giữ nguyên." }); }
      finally { if (current(n)) update({ busy: false }); }
    },
    move(key: string, direction: -1 | 1) { if (state.busy) return; const entries = [...state.entries], i = entries.findIndex(e => e.key === key), j = i + direction; if (i < 0 || j < 0 || j >= entries.length) return; [entries[i], entries[j]] = [entries[j], entries[i]]; update({ entries }); },
    confirmedIds() { requireOwner(); if (state.busy || state.entries.some(e => e.status !== "confirmed" || !e.media || Date.parse(e.media.expiresAt) <= now())) throw new AuthError("MEDIA_NOT_READY", "Tải lại ảnh chưa được xác nhận hoặc đã hết hạn trước khi đăng tin."); return state.entries.map(e => e.media!.id); },
    dispose() { reset(); unsubscribe(); listeners.clear(); },
  };
}
export type ListingMediaModel = ReturnType<typeof createListingMediaModel>;
