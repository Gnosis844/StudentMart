import { AuthError } from "../../auth/business/auth";
import type { AuthCoordinator } from "../../auth/business/auth-coordinator";
import type { ApiRequest } from "../../auth/data/registration-api";
import type { ListingCreateRepository, ListingLookup, OwnListing, ListingSubmission } from "../business/listing-create";
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const invalid = () => new AuthError("INVALID_RESPONSE", "Máy chủ chưa trả về dữ liệu tin đăng hợp lệ. Chưa xác nhận đăng thành công.");
function lookup(v: unknown): ListingLookup { const x = v as ListingLookup | null; if (!x || !uuid(x.id) || typeof x.name !== "string") throw invalid(); return { id: x.id, name: x.name }; }
export function parseOwnListing(value: unknown): OwnListing {
  const v = value as OwnListing | null;
  if (!v || !uuid(v.id) || !["SELL", "BUY", "EXCHANGE"].includes(v.type) || typeof v.title !== "string" || typeof v.description !== "string" || !Number.isInteger(v.version) || v.version < 1 || !v.owner || !uuid(v.owner.id) || typeof v.owner.displayName !== "string" || !v.lifecycle || !["OPEN", "COMPLETED", "CLOSED", "REMOVED"].includes(v.lifecycle.status) || !Array.isArray(v.images) || v.images.length > 8) throw invalid();
  const images = v.images.map(i => { if (!uuid(i.id) || typeof i.url !== "string" || !i.url.startsWith("https://") || !Number.isInteger(i.width) || !Number.isInteger(i.height)) throw invalid(); return { id: i.id, url: i.url, width: i.width, height: i.height }; });
  if (v.type === "SELL" && (!Number.isInteger(v.price) || v.price! < 0)) throw invalid();
  if (v.type === "BUY" && !(v.budget === null || Number.isInteger(v.budget) && v.budget! >= 0)) throw invalid();
  if (v.type === "EXCHANGE" && typeof v.exchangeWanted !== "string") throw invalid();
  return { id: v.id, type: v.type, title: v.title, description: v.description, version: v.version, category: lookup(v.category), area: lookup(v.area), images, owner: { id: v.owner.id, displayName: v.owner.displayName, avatarUrl: typeof v.owner.avatarUrl === "string" ? v.owner.avatarUrl : null }, lifecycle: { status: v.lifecycle.status }, ...(v.type === "SELL" ? { price: v.price } : v.type === "BUY" ? { budget: v.budget } : { exchangeWanted: v.exchangeWanted }) };
}
export function createListingCreateRepository(origin: string, auth: AuthCoordinator, request: ApiRequest = fetch): ListingCreateRepository {
  async function send(path: string, token: string, signal: AbortSignal, input?: unknown, key?: string, missing = false) {
    const controller = new AbortController(); const abort = () => controller.abort();
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
      const response = await request(`${origin}/api/v1${path}`, { method: input ? "POST" : "GET", signal: controller.signal, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json", "Idempotency-Key": key! } : {}) }, ...(input ? { body: JSON.stringify(input) } : {}) });
      if (missing && response.status === 404) return null;
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const code = body?.error?.code;
        if (response.status === 401) throw new AuthError(code === "SESSION_EXPIRED" ? code : "UNAUTHENTICATED", "Phiên đăng nhập đã hết hiệu lực.");
        if (response.status === 403) throw new AuthError("FORBIDDEN", "Tài khoản hiện không được phép đăng tin.");
        if (response.status === 400) throw new AuthError("VALIDATION_ERROR", "Thông tin chưa hợp lệ. Kiểm tra nội dung, danh mục và khu vực rồi thử lại.");
        if (response.status === 409) throw new AuthError(code === "MEDIA_UNAVAILABLE" ? code : "IDEMPOTENCY_CONFLICT", code === "MEDIA_UNAVAILABLE" ? "Ảnh đã hết hạn hoặc không còn khả dụng. Hãy tải lại ảnh." : "Lần gửi này chưa thể thực hiện lại với nội dung khác. Hãy đối chiếu kết quả trước.");
        if (response.status === 410) throw new AuthError("IDEMPOTENCY_EXPIRED", "Khóa lần đăng trước đã hết hạn. Không tự tạo tin mới khi chưa xác định kết quả.");
        if (response.status === 429) throw new AuthError("RATE_LIMITED", "Bạn thao tác quá nhanh. Hãy chờ rồi thử lại cùng lần gửi.");
        throw new AuthError("SERVICE_UNAVAILABLE", "Máy chủ chưa xác nhận kết quả. Giữ nguyên lần gửi để đối chiếu rồi thử lại.");
      }
      if (response.status !== (input ? 201 : 200) || !body) throw invalid();
      return { ...body, __replayed: response.headers.get("Idempotency-Replayed") === "true" };
    } catch (error) { if (error instanceof AuthError) throw error; throw new AuthError("NETWORK_ERROR", "Chưa nhận được xác nhận từ máy chủ. Kiểm tra mạng rồi đối chiếu/thử lại cùng lần gửi."); }
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  }
  return {
    catalog: () => auth.runPrivate(async (token, signal) => { const [c, a] = await Promise.all([send("/catalog/listing-categories", token, signal), send("/catalog/areas", token, signal)]); if (!Array.isArray(c?.items) || !Array.isArray(a?.items)) throw invalid(); return { categories: c.items.map(lookup), areas: a.items.map(lookup) }; }),
    create: (input, key) => auth.runPrivate(async (token, signal) => { const body = await send("/listings", token, signal, input, key); const fresh = body.__replayed ? await send(`/me/listings/${parseOwnListing(body.listing).id}`, token, signal) : body; const listing = parseOwnListing(fresh.listing); if (listing.owner.id !== auth.getSnapshot().account?.id) throw invalid(); return listing; }),
    get: id => auth.runPrivate(async (token, signal) => { if (!uuid(id)) throw invalid(); const body = await send(`/me/listings/${id}`, token, signal); const listing = parseOwnListing(body.listing); if (listing.owner.id !== auth.getSnapshot().account?.id) throw invalid(); return listing; }),
    submission: key => auth.runPrivate(async (token, signal) => { if (!uuid(key)) throw invalid(); const body = await send(`/me/listing-submissions/${key}`, token, signal, undefined, undefined, true); if (body === null) return null; const s = body.submission as ListingSubmission; if (!s || body.submission.operation !== "CREATE" || s.key !== key || !["PROCESSING", "SUCCEEDED", "FAILED", "EXPIRED"].includes(s.state) || !(s.listingId === null || uuid(s.listingId)) || (s.state === "SUCCEEDED" && !s.listingId) || (["PROCESSING", "FAILED"].includes(s.state) && s.listingId !== null)) throw invalid(); return { key: s.key, state: s.state, listingId: s.listingId, errorCode: typeof s.errorCode === "string" ? s.errorCode : null }; }),
  };
}
