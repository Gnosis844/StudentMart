import { AuthError } from "../../auth/business/auth";
import type { AuthCoordinator } from "../../auth/business/auth-coordinator";
import type { ApiRequest } from "../../auth/data/registration-api";
import { parseListingMedia, type ListingImageAsset, type ListingMediaRepository } from "../business/listing-media";
export function createListingMediaRepository(origin: string, auth: AuthCoordinator, request: ApiRequest, form: (asset: ListingImageAsset) => FormData): ListingMediaRepository {
  async function send(token: string, signal: AbortSignal, id?: string, body?: FormData) {
    const controller = new AbortController(); let timedOut = false; const abort = () => controller.abort();
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; abort(); }, 30000);
    try {
      const response = await request(origin + "/api/v1/listing-media" + (id ? "/" + encodeURIComponent(id) : ""), { method: id ? "DELETE" : "POST", body, signal: controller.signal, headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      if (!response.ok) {
        const codes: Record<number, [string, string]> = { 400: ["VALIDATION_ERROR", "Máy chủ từ chối ảnh. Kiểm tra loại file hoặc quyền sở hữu."], 401: ["UNAUTHENTICATED", "Phiên đăng nhập hết hiệu lực."], 403: ["FORBIDDEN", "Bạn không có quyền xử lý ảnh này."], 404: ["NOT_FOUND", "Ảnh không tồn tại hoặc đã hết hạn."], 409: ["CONFLICT", "Ảnh đang được sử dụng hoặc thao tác đang xung đột."], 413: ["PAYLOAD_TOO_LARGE", "Mỗi ảnh tối đa 10 MiB."], 415: ["UNSUPPORTED_MEDIA_TYPE", "Chọn ảnh JPEG, PNG hoặc WebP hợp lệ."], 429: ["RATE_LIMITED", "Đã đạt giới hạn tải ảnh. Hãy thử lại sau."], 503: ["SERVICE_UNAVAILABLE", "Dịch vụ lưu ảnh chưa sẵn sàng. Hãy thử lại sau."] };
        const [code, message] = codes[response.status] ?? ["SERVICE_UNAVAILABLE", "Máy chủ chưa xử lý được ảnh. Hãy thử lại."]; throw new AuthError(code, message);
      }
      if (id) { if (response.status !== 204) throw new AuthError("INVALID_RESPONSE", "Chưa xác nhận xóa ảnh."); return null; }
      if (response.status !== 201) throw new AuthError("INVALID_RESPONSE", "Chưa xác nhận tải ảnh.");
      return parseListingMedia((await response.json()).media);
    } catch (error) { if (error instanceof AuthError) throw error; throw new AuthError(timedOut ? "UPLOAD_TIMEOUT" : "NETWORK_ERROR", timedOut ? "Tải ảnh quá 30 giây. Kết quả chưa rõ; có thể thử lại, ảnh chưa gắn tin sẽ tự hết hạn." : "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."); }
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  }
  return { upload: asset => auth.runPrivate(async (token, signal) => { const media = await send(token, signal, undefined, form(asset)); if (!media) throw new AuthError("INVALID_RESPONSE", "Thiếu dữ liệu ảnh."); return media; }), remove: id => auth.runPrivate(async (token, signal) => { await send(token, signal, id); }) };
}
