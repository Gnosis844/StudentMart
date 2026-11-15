# TASK-04.01 — Hợp đồng dữ liệu, quyền và vòng đời tin

Phạm vi #121, BE #122, FE #123; nguồn #5/#4, Wiki US02–US04/US08 và UF02a/UF02b, source tại main sau PR #120. [OpenAPI](listings.openapi.yaml) là payload contract; [mobile](listing-mobile.md) quy định mapping và hành vi client. Đây là **đề xuất contract 0.1.0 chờ người dùng review PR**, không phải API/entity/migration đã triển khai. Không bật synchronize, không apply migration trong ticket này.

## Hiện trạng và ranh giới

Account/session, Area và avatar Cloudinary đã có source; danh mục được duyệt vẫn cần kiểm tra dữ liệu thực. `mobile/src/features/listings/business/listing-gateway.ts` hiện dùng `unavailableListings`, không có backend Listing API. TASK-03 #4 đóng không chứng minh schema đã có; yêu cầu của issue chỉ là baseline thiết kế. Không tự sửa gateway thành dữ liệu demo để coi như đã tích hợp.

TASK-04 sở hữu tạo, sửa, Tin của tôi và trạng thái bền vững. TASK-05 #6 sở hữu tìm kiếm/bộ lọc; TASK-06 #7 sở hữu chi tiết công khai/chat; TASK-07 #8 sở hữu đồng bộ các bên đọc, chặn hội thoại mới trên tin kết thúc và quyền hội thoại cũ. TASK-23 #24 sở hữu persistence bản nháp/phục hồi; TASK-04 cung cấp validation, submission key và điểm tích hợp. Không xây đơn hàng, thanh toán, escrow, giao hàng, tự động ghép trao đổi hay yêu thích.

## Giá trị đề xuất để review trước runtime

Các ngưỡng dưới đây là quyết định thiết kế được đưa vào PR để review, không phải chính sách sản phẩm đã được duyệt từ trước. Thay đổi ngưỡng phải sửa OpenAPI, mobile và fixture cùng lúc trước các ticket triển khai.

| Field/quy tắc | Contract 0.1.0 đề xuất | Căn cứ/giới hạn |
|---|---|---|
| title | Trim, 10–120 Unicode code point | Min 10 khớp thông báo trong ảnh design; max 120 đề xuất |
| description | Trim, 1–5000 code point | Nội dung món/khuyết điểm; Tìm mua dùng làm yêu cầu |
| exchangeWanted | Trim, 1–2000 code point | Chỉ Trao đổi, mô tả món/điều kiện muốn đổi |
| Giá/ngân sách | Integer VND, 0–1.000.000.000 | Không số thập phân/chuỗi; zero là chủ ý nhập 0, không suy từ null |
| Ảnh | Bán/Trao đổi 1–8; Tìm mua 0–8 | Thứ tự mediaIds là thứ tự hiển thị; không ID trùng |
| File tin đăng | JPEG/PNG/WebP, tối đa 10 MiB/file; 24 megapixel, mỗi chiều ≤12000px | Đề xuất độc lập với avatar 5 MiB; decode/re-encode, bỏ metadata, giới hạn tài nguyên server |
| Tình trạng | USED_GOOD, USED_FAIR, NEEDS_REPAIR | Tương ứng đã dùng tốt/đã dùng có hao mòn/cần sửa; nhãn cụ thể cần review cùng ảnh design |
| Phân trang | limit mặc định 20, 1–50; cursor opaque ≤1024 ký tự | Tin của tôi; không tự áp cho search API |
| Idempotency | Replay response 24 giờ từ admission server | Tombstone giữ bền vững sau 24h; không tạo lại bằng key cũ |
| Media chưa gắn | Hết hạn sau 24h từ upload | Cleanup không xóa media đã được transaction gắn tin |

Không NFC-normalize nội dung, không trim password/token; độ dài text phải tính `Array.from(text).length` ở JS để khớp code point/schema/PostgreSQL. Validate sau trim; object request whitelist, field lạ trả 400. Không nhận ownerId, role, trạng thái hoặc nhãn verify từ client.

## Payload và projection

CreateListingRequest là union chặt ba type, field bắt buộc khác nhau:

- SELL: type, title, description, categoryId, areaId, condition, price, mediaIds.
- BUY: type, title, description, categoryId, areaId, budget, mediaIds. UX không nhập ngân sách serialize `budget: null`; không ảnh serialize `mediaIds: []`. Không gửi condition/price/exchangeWanted.
- EXCHANGE: type, title, description, categoryId, areaId, condition, exchangeWanted, mediaIds. Khoản bù thêm thỏa thuận ngoài app/chat, không thêm cơ chế thanh toán.

PUT cập nhật đầy đủ cùng shape, thêm expectedVersion ≥1; không PATCH half-state khó xác minh. Omit field bắt buộc là 400, null chỉ hợp lệ với budget. Type bất biến sau đăng; chuyển loại trong draft được client xử lý trước tạo. Cần thay type sau đăng thì là scope mới, không âm thầm hỗ trợ. Khi PUT, mediaIds là toàn bộ danh sách ảnh mong muốn sau lưu; transaction kiểm tra lại ảnh, quyền, trạng thái và version trước ghi.

Response `{listing}` dùng Listing với id, nội dung theo type, category/area `{id,name}`, images `{id,url,width,height}`, owner `{id,displayName,avatarUrl}`, lifecycle, version, createdAt/updatedAt UTC. Không trả email login/email trường, role, token/hash, media publicId hoặc key Cloudinary. Owner summary hiện tối thiểu; public profile/verification thuộc contract TASK-06 và phải lấy nguồn backend thật, không suy từ email hoặc trường tự khai. URL ảnh HTTPS công khai; không đặt bearer vào ảnh/query. Private replies và mutation/reconciliation dùng `Cache-Control: no-store`.

Owner API có cùng projection nội dung nhưng phạm vi truy cập riêng; gỡ tin không là DELETE row ngay. Chính sách truy cập nội dung bị quản trị gỡ phải giữ quyết định quản trị; owner vẫn có thể thấy summary trạng thái, không cấp quyền sửa hoặc khôi phục. AccountId trên query không đổi actor. Endpoint `/me/listings/{listingId}` trả 404 nếu không phải chủ tin, tránh dò tồn tại.

## Mô hình code-first cho ticket sau

| Aggregate/table dự kiến | Invariant và dữ liệu |
|---|---|
| Listing | UUID id, owner FK Account, immutable type, title/description, nullable type-specific price/budget/condition/exchangeWanted, category FK và area FK, lifecycle fields, version, timestamps |
| ListingCategory | ID ổn định, code unique, name, trạng thái hỗ trợ theo catalog thật; không seed tên tự đoán |
| ListingMedia | UUID, owner FK, Cloudinary reference riêng, validated format/size/dimensions, trạng thái staged/attached/deleting/deleted, created/expires timestamps |
| ListingImage | Listing FK + media FK, position; media unique một listing, không dùng avatar asset, không vượt ảnh tối đa |
| ListingMutation | UNIQUE(actorId,key), method/resource, canonical payload hash, status, result listingId/version, replay snapshot hoặc safe failure, admitted/replayUntil timestamps; durable tombstone |

CHECK ràng buộc giá/type/field nullable và lifecycle; FK không cascade xóa tin khi người dùng xóa avatar hoặc thay catalog. Nguồn category/area được duyệt là dependency, ID hiện có phải xác minh theo DB chứ không dựa trạng thái issue CLOSED. Danh mục thiếu: catalog trả rỗng hoặc lỗi thật; FE không tự nhập danh mục giả để submit. Thiết kế migration sinh từ entity ở #128/#125/#131, review SQL up/down, apply đúng scope; schema ở đây chưa tồn tại.

Ảnh gắn mới phải thuộc owner hiện tại, đã validate, chưa hết hạn, chưa gắn tin khác. Lock và gắn media cùng transaction Listing để hai request không dùng trùng. Gỡ ảnh khỏi tin chỉ đưa vào cleanup sau commit, không xóa file trước khi dữ liệu mới commit. Cleanup staged hết hạn phải khóa/kiểm tra lại chưa attached; API DELETE media từ chối xóa media còn được tin tham chiếu (409 MEDIA_UNAVAILABLE). Retry xóa không xóa tài khoản/tin/ảnh owner khác. Việc upload Cloudinary và SQL không có distributed transaction: dùng durable cleanup intent/reconciliation cho asset mồ côi và thất bại provider; source avatar hiện tại chỉ là nền tham khảo, không gọi endpoint avatar cho ảnh tin.

## Ma trận quyền và trạng thái

| Actor/trạng thái | Đọc riêng | Sửa nội dung | COMPLETE/CLOSE | REMOVE |
|---|---|---|---|---|
| Guest | Không, 401 | Không | Không | Không |
| Owner còn quyền, OPEN | Có | Có, version đúng | Có | Có |
| Owner còn quyền, COMPLETED/CLOSED | Có | Không | Không đổi sang kết quả khác | Có, giữ audit kết quả trước |
| Owner, REMOVED | Summary theo policy | Không | Không | Chỉ replay cùng key, không restore |
| Tài khoản khác | Không, 404 | Không | Không | Không |
| ADMIN | Không mặc nhiên dùng owner endpoint thay owner | Không sửa hộ qua owner API | Không tự tuyên bố giao dịch hoàn tất | Qua policy/endpoint quản trị TASK-22 #23, không phải endpoint owner |
| Account bị hạn chế | 403 theo policy hiện tại | 403 | 403 | 403 theo policy |

Owner mutation kiểm tra identity/permission tại lúc thao tác; không chặn chỉ vì schoolVerification UNVERIFIED. Quyền ADMIN xác minh server, không do body/header role tự khai. Transaction trạng thái và audit actor phải nguyên tử. Quản trị gỡ từ OPEN/COMPLETED/CLOSED → REMOVED với removalActor ADMIN theo TASK-22. Owner chỉ gỡ tin của mình với actor OWNER. Không hỗ trợ reopen/reset trạng thái hoặc khôi phục tin admin gỡ trong v1.

Lifecycle nested đầy đủ `{status, completion, removalActor}`:

- OPEN: completion null, removalActor null.
- COMPLETED: completion SOLD cho SELL, FOUND cho BUY, EXCHANGED cho EXCHANGE; removalActor null. Đây là lời xác nhận của chủ tin, không phải nền tảng xác minh giao dịch.
- CLOSED: completion null, removalActor null.
- REMOVED: completion null, removalActor OWNER/ADMIN. Audit giữ trạng thái trước khi gỡ; reporting không suy giao dịch hoàn tất chỉ từ hành động đóng/gỡ.

State schema kiểm tra loại field; tương thích COMPLETED với listing type là invariant semantic bắt buộc BE test, không tuyên bố oneOf Lifecycle tự kiểm tra được cross-field đó. OPEN → COMPLETE/CLOSE/REMOVE; COMPLETED/CLOSED → REMOVE; không transition khác. Các thao tác lặp chỉ replay cùng idempotency key; key mới với version cũ là conflict, không tạo thêm event. Áp dụng version check và lock tại commit; concurrent sửa/admin gỡ chỉ một bên thắng, không ghi đè quyết định quản trị.

## Idempotency, retry và kết quả chưa rõ

POST create, PUT content và POST transition bắt buộc UUID `Idempotency-Key`. Namespace theo actor, không theo token/thiết bị: đổi phiên cùng account vẫn reconcile được; B không đọc/replay key của A. Key bind cả method, target và payload normalized canonical: sort object keys đệ quy, giữ thứ tự array/media; không phụ thuộc whitespace JSON. Same key khác target hoặc canonical payload →409 IDEMPOTENCY_CONFLICT, không chạy mutation mới.

Admission ghi durable attempt UNIQUE(actorId,key) trước side effects; transaction kết quả Listing/ảnh và status SUCCEEDED cùng commit. Same key đang PROCESSING →409 IDEMPOTENCY_IN_PROGRESS + Retry-After; không chạy song song. Thành công đã commit mà response mất → retry same key trả snapshot ban đầu trong 24h, không nhân bản, kể cả state hiện tại đã đổi. Reply phải nêu đây là replay bằng header `Idempotency-Replayed: true`; mobile sau reconcile GET current owner listing để nạp version mới, không overwrite state mới bằng snapshot cũ.

Lỗi terminal đã admission lưu FAILED và safe error/replay; lỗi JSON/schema không admission thì không có side effect. Ghi rõ FAILED chỉ khi server chắc chắn không có mutation commit; crash/stale PROCESSING phải được server recovery đối chiếu DB và hoàn tất record, không tự cho client tạo key mới. Network timeout/503 không phải bằng chứng thất bại.

GET `/me/listing-submissions/{key}` trả key/operation/state/listingId/resultVersion/errorCode/replayUntil. PROCESSING có null result; SUCCEEDED có listingId/resultVersion, errorCode null; FAILED có safe errorCode, không có listingId/resultVersion; EXPIRED giữ listingId/resultVersion nếu từng success hoặc null nếu chưa có kết quả. Field consistency là invariant semantic cần test implementation. 404 unknown có thể do request tạo chưa admission/in flight: **không cấp quyền tạo key mới**; giữ cùng key và retry/reconcile, không tự kết luận chưa đăng.

Sau 24h bỏ response/payload chi tiết nếu cần nhưng giữ durable tombstone UNIQUE actor/key, operation, hash và outcome reference. Mutation bằng expired key →410 IDEMPOTENCY_EXPIRED; GET known expired vẫn trả EXPIRED với reference nếu có, không chuyển thành unknown. Client không tự lấy key mới sau expiry; nếu có listingId thì đọc tin đó; nếu outcome không thể chứng minh, giữ cảnh báo và yêu cầu đối chiếu/hỗ trợ, không công khai lần thứ hai. Client chủ động bắt đầu một tin mới sau khi xác định kết quả là hành động khác, không là retry tự động.

## Concurrency và phân trang

expectedVersion so với row version dưới lock; version tăng 1 mỗi mutation thành công. Stale version →409 VERSION_CONFLICT kèm safe message; mobile giữ input, cho đọc current rồi quyết định áp dụng lại với key mới của một thay đổi mới sau review. Không tự refresh version rồi retry ghi đè. Replay check xảy ra trước version check đối với key đã xử lý, để retry của chính mutation không bị coi xung đột giả.

Tin của tôi sort createdAt DESC, id DESC. Cursor opaque có chữ ký/binding actor + status filter + sort + last boundary; cursor account khác/filter khác/hỏng →400 INVALID_CURSOR, không fallback list rộng. limit không làm thay đổi sort; cursor phân trang keyset không promise snapshot xuyên update. Owner lifecycle thay đổi giữa các trang có thể khiến item chuyển filter; mobile dedupe theo id và refresh từ đầu khi cần. Public search/detail routing và lọc trạng thái thuộc #6/#7/#8, không được coi đã implement bởi contract owner này.

## Lỗi và kiểm chứng

Envelope `{error:{code,message,requestId,fields?}}`, không stack/provider text/token. 400 validation/cursor;401 session;403 restriction;404 owner miss;409 version/transition/idempotency/media conflict;410 expired key;413/415 media;429 Retry-After;503 unavailable. Mutation thành công chỉ sau server commit, không dùng optimistic success. GET catálogo guest không đồng nghĩa guest có quyền tạo/sửa tin.

Schema fixtures/validator ở ticket QA chỉ chứng minh payload contract, không chứng minh runtime uniqueness/locks/ownership/canonicalization/recovery. #128/#131 phải có HTTP/PostgreSQL test A/B, missing/expired session, role/owner injection, concurrent submit, crash/retry lost ACK, canonical key mismatch, media race/expiry, rollback và version/admin race. Native, Cloudinary thật và bản nháp bền vững có bằng chứng riêng ở ticket sở hữu. Source/manifest được đối chiếu, nhưng **không có API Listing mới hoặc migration trong #121**.
