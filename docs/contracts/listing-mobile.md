# TASK-04.01 — Hợp đồng mobile tin đăng (#121 / #123)

Tài liệu cho React Native/Expo, đọc cùng [OpenAPI](listings.openapi.yaml), [mô hình BE](listing-model.md) và [review thiết kế](listing-design-review.md). Truy vết R02–R04, R08 → US02–US04, US08 → UF02a/UF02b.

**Trạng thái:** baseline đề xuất để review PR trước khi triển khai #124–#135. Các giới hạn số dưới đây chưa phải quyết định sản phẩm đã được người dùng duyệt. #121 không dựng màn hình, gọi API tin đăng, tạo entity hoặc apply migration.

## Source hiện tại và ranh giới

Đã đọc `mobile/package.json`, `mobile/App.tsx`, `listing-gateway.ts`, `session-navigation.ts` và auth/account cleanup. App dùng Expo 58, React Native, API origin public `EXPO_PUBLIC_API_URL`, credential SecureStore và auth epoch. `unavailableListings` vẫn fail closed; `PublicListing` hiện chỉ là port nội bộ `{id,title,description,open}`, không đủ thay cho DTO được đặc tả ở đây. Route `compose` hiện là thông báo chưa sẵn sàng; không được coi gateway/placeholder là chức năng đăng tin đã có.

Phân công tiếp theo: ảnh #124–#126; tạo tin #127–#129; Tin của tôi/sửa/kết thúc #130–#132; kiểm thử #133–#135. TASK-23 #24 sở hữu persistence bản nháp/phục hồi, TASK-07 #8 sở hữu đồng bộ tìm kiếm/chi tiết/chat và điều kiện hội thoại. Tài liệu này định nghĩa boundary để các task đó phối hợp, không tự triển khai lại module của chúng.

## Tổ chức model và gọi dữ liệu

Luồng bắt buộc: Screen → ViewModel hook → business service → repository/DTO mapper → HTTP hoặc draft adapter. Screen không tự đọc token, gọi HTTP, đọc filesystem hay serialize draft. Giữ `mobile/index.ts`, không giả định có router/UI kit/form library mới.

| Layer dự kiến | Trách nhiệm |
|---|---|
| `features/listings/presentation/` | Composer, MyListings, editor, dialog xác nhận, trạng thái loading/error/empty và accessibility |
| `features/listings/business/` | Discriminated union theo loại, validation, submission state machine, dirty/version handling; không import JSX |
| `features/listings/data/` | Repository, strict response mapper, API adapter và cổng draft theo account |
| `navigation/` | Route/intent ngữ nghĩa, kiểm tra auth hiện tại, Back/foreground và trở lại đúng ngữ cảnh |
| `bootstrap/` hoặc composition hiện có | Ghép adapter, đăng ký cleanup private và lifecycle cancellation |

Các tên model dưới đây là hợp đồng, không phải các file/runtime export đã được thêm:

```ts
type ListingType = "SELL" | "BUY" | "EXCHANGE";
type ItemCondition = "USED_GOOD" | "USED_FAIR" | "NEEDS_REPAIR";
type CommonInput = {
  title: string; description: string; categoryId: string; areaId: string;
  mediaIds: string[];
};
type ListingInput =
  | (CommonInput & { type: "SELL"; condition: ItemCondition; price: number })
  | (CommonInput & { type: "BUY"; budget: number | null })
  | (CommonInput & { type: "EXCHANGE"; condition: ItemCondition; exchangeWanted: string });
type UpdateListingInput = ListingInput & { expectedVersion: number };
```

Input UI giữ tiền dưới dạng chuỗi nhập, file local và dirty metadata riêng. Mapper tạo đúng một nhánh của union; không gửi field của loại khác, `ownerId`, trạng thái, role, verify, URL Cloudinary hoặc provider public ID. Dùng `mediaIds` đã server xác nhận. Loại tin chọn được khi tạo, bất biến sau khi tạo trong baseline này; editor không đổi `type` dù ảnh thiết kế có chips.

Response đọc theo schema OpenAPI: giữ UUID/string, số nguyên VND/version, UTC ISO timestamp, null và object lifecycle đúng shape; không `Number(null)`, không cast mọi payload thành model bằng `as`. Reject sai kiểu/thiếu trường bắt buộc hoặc tổ hợp status/completion/removalActor mâu thuẫn. Whitelist field map sang UI; không copy token/session/provider reference vào model công khai hay draft. Field optional tương lai không được tự biến thành quyền mới.

## Validation và trình bày ba loại tin

| Field | Đề xuất baseline cho review | UX / wire mapping |
|---|---|---|
| title | trim, 10–120 Unicode code point | Thông báo ngay tại field; không đo bằng UTF-16 `length` |
| description | trim, 1–5000 code point | Mô tả yêu cầu BUY hoặc món đồ/khuyết điểm SELL/EXCHANGE |
| categoryId, areaId | UUID thuộc catalog được hỗ trợ | Chọn thủ công, không GPS; không lấy danh sách mẫu trong ảnh làm seed |
| SELL condition, price | condition bắt buộc; price nguyên VND 0–1.000.000.000 | Hiện nhãn Giá bán; không bỏ field khi giá hợp lệ bằng 0 |
| BUY budget | `null` hoặc nguyên VND 0–1.000.000.000 | Ô trống → null; hiện “Chưa nêu ngân sách”, không hiện 0/miễn phí |
| EXCHANGE condition, exchangeWanted | condition bắt buộc; nội dung muốn đổi trim 1–2000 code point | Không thêm giá bán/budget, đơn hàng hay ghép đổi tự động |
| mediaIds | duy nhất; SELL/EXCHANGE 1–8, BUY 0–8 | Ảnh tham khảo BUY không bắt buộc; ảnh tải lỗi không tính vào số ảnh hợp lệ |
| ảnh trước upload | JPEG/PNG/WebP, tối đa 10 MiB/ảnh, tối đa 8 ảnh; tối đa 24 megapixel, mỗi chiều ≤12000px | Đề xuất riêng cho ảnh tin; không sao chép ngầm giới hạn avatar 5 MiB. Kiểm tra client chỉ là hỗ trợ; BE kiểm tra giải mã/tài nguyên cuối cùng |

BE là nơi quyết định validation và quyền cuối cùng. Frontend hỗ trợ UX theo cùng rule; Unicode dùng `Array.from(value).length` sau trim. Tiền chỉ nhận biểu diễn số nguyên hợp lệ, bỏ dấu nhóm hiển thị bằng mapper có quy tắc rõ; không parse sai chuỗi rỗng, số âm, số thập phân hoặc overflow thành giá hợp lệ. Giá trị vượt giới hạn phải báo lỗi, không clamp âm thầm. Danh mục/area không tồn tại hoặc bị ngừng hỗ trợ được trả về lỗi field và giữ nội dung để sửa.

Lookup hiện có School/Area và API hồ sơ không chứng minh đã có catalog Category hay dataset khu vực listing được duyệt. Khi nguồn chưa có/đang lỗi, hiển thị chưa tải được danh mục, cho retry và không submit ID giả. Empty dữ liệu hợp lệ phải khác lỗi tải. Nhãn và UUID trong ảnh là demo, không nguồn production.

## API repository và route

Mọi path dưới `/api/v1`; OpenAPI là nguồn chính xác về envelope, headers và lỗi. Không thêm endpoint giả để làm gateway hiện tại trông như hoạt động.

| Thao tác repository | API dự kiến | Điều phối mobile |
|---|---|---|
| create(input, key) | POST `/listings` | Chỉ báo Đăng thành công sau response hợp lệ của server |
| listMine(cursor, filters) | GET `/me/listings` | Trang tiếp theo theo cursor opaque; không tự tăng offset, không dùng count demo |
| loadMine(id) | GET `/me/listings/{id}` | Prefill editor bằng phiên bản mới nhất; route không mang whole payload/token |
| update(id, input, key) | PUT `/me/listings/{id}` | Full replacement content theo union cùng expectedVersion, không PATCH field tùy ý |
| transition(id, action, version, key) | POST `/me/listings/{id}/transitions` | COMPLETE/CLOSE/REMOVE sau dialog xác nhận |
| reconcile(key) | GET `/me/listing-submissions/{key}` | Đối chiếu kết quả chưa rõ trước khi retry hoặc bắt đầu attempt mới |

Catalog GET `/catalog/listing-categories` và `/catalog/areas` trả `{items}`; Area dùng nguồn account catalog thật, không dataset mới tự đặt. Media dùng API listing-media theo OpenAPI. `listMine` trả `{items,nextCursor}`, limit mặc định 20, tối đa 50; cursor opaque không dài quá 1024 ký tự, gắn actor/filter và sort ổn định. Đổi filter bỏ cursor cũ, ghép trang theo ID/version để tránh render trùng; không coi cursor là quyền đọc account khác.

Listing response giữ nội dung theo union, `category`/`area: {id,name}`, `images: {id,url,width,height}[]`, `owner: {id,displayName,avatarUrl}`, lifecycle/version/timestamps. Response không dùng `mediaIds` input thay ảnh đã xác nhận; editor lấy ID ảnh từ `images` khi tạo full PUT. Một media chỉ gắn một listing; reorder ảnh giữ thứ tự array. Chủ tin chỉ sửa OPEN; COMPLETED/CLOSED chỉ còn REMOVE, REMOVED không sửa/khôi phục. Projection không có email riêng, role, credential hay Cloudinary public ID.

Các API ảnh/catalog và DTO projection tuân thủ OpenAPI, không dùng `/accounts/me/avatar` để upload ảnh tin đăng. Không lưu Cloudinary secret trong `EXPO_PUBLIC_*`; dùng adapter native `File` + `expo/fetch` đã kiểm chứng với SDK58 khi task ảnh triển khai. Hủy picker không mất ảnh đã chọn; lỗi upload giữ local asset để retry nếu còn đọc được, local file hết khả dụng thì yêu cầu chọn lại. Media staged hết hạn sau 24 giờ từ upload theo đề xuất BE: khi mở draft phải kiểm tra lại, không giữ mediaId hết hạn như ảnh đã sẵn sàng đăng; cho upload lại khi còn file local. Cleanup chỉ xóa asset thực sự chưa attached, không xóa ảnh còn được tin tham chiếu.

Route ngữ nghĩa dự kiến: `composeListing` (draftId hoặc không), `myListings` (filter), `editListing` (listingId); dialog kết thúc là state UI gắn listingId/version, không phải mutation tự động khi mở route. Tên được map vào bộ navigation thực tế ở ticket runtime, không cài router chỉ vì tài liệu này.

Khách bấm đăng tin/Tin của tôi/sửa → login với intent được parse whitelist; đăng nhập xong kiểm tra lại phiên/quyền và nạp dữ liệu mới. Không yêu cầu verify email trường. Account bị hạn chế hoặc phiên hết hạn không submit được. Sau login/foreground/đổi account, không replay mutation chỉ từ intent hoặc route; cần hành động xác nhận của người dùng và draft đúng owner.

## ViewModel state, lỗi và cache

| State | Dữ liệu/hành động |
|---|---|
| initial/loading | Đọc catalog hoặc listing; không hiển thị nội dung tài khoản trước |
| ready/editing | Giữ input và ảnh local, dirty so với server snapshot/blank draft; save disabled nếu chưa đổi |
| uploading | Hiển thị số ảnh đã server xác nhận và tiến trình không xác định nếu không có progress thật; chặn thao tác xung đột |
| submitting | Chụp payload/key/version bất biến; chống double tap; không hiển thị success trước ACK |
| outcomeUnknown/reconciling | Timeout/mất mạng sau gửi có thể đã lưu; giữ payload/key, không tự tạo key mới hoặc xóa draft |
| confirmed | Xác minh response, cập nhật snapshot/version và cache của account hiện tại; điều hướng bằng ID server |
| validationError | Map `fields` theo field, giữ form/ảnh; lỗi chung đặt ngoài field |
| conflict | Server version/trạng thái đã đổi: giữ bản sửa riêng, nạp snapshot mới và yêu cầu người dùng đối chiếu, không tự overwrite |
| unavailable/offline | Cho retry; không biến lỗi thành danh sách rỗng hoặc danh mục giả |
| authLost/forbidden | Dừng request/khóa mutation, xử lý phiên theo AuthCoordinator; không báo thành công hoặc tự đổi sang account khác |

Repository gọi qua `AuthCoordinator.runPrivate` hoặc boundary tương đương, kiểm tra accountId + epoch trước và sau mỗi request. Abort khi logout/đổi danh tính; generation guard bỏ phản hồi A trễ dù transport không hủy kịp. Private cache key phải chứa accountId; pagination reset khi đổi account/filter. Public cache nằm ngoài cleanup private, nhưng phải invalidate hoặc đánh stale sau mutation đã xác nhận để TASK-07 refresh nguồn thật.

Rời form bằng header Back, Android Back, đổi tab hoặc gesture phải có chính sách thống nhất: giữ draft theo TASK-23, có lựa chọn tiếp tục/loại bỏ; không âm thầm xóa dữ liệu. Khi đang gửi, giải thích attempt chưa xác nhận; không coi hủy màn hình là hủy giao dịch server. Foreground/picker return không reset draft cùng owner chỉ vì kiểm tra lại phiên. Khi quyền mất, giữ bản nháp trong scope đã được phép và không công khai; không lưu credential vào draft để retry.

## Retry và submission identity

Tạo UUID `Idempotency-Key` cho một attempt sau khi payload canonical được chốt; persist attempt trước gửi. Key scope thuộc actor và snapshot method/path/payload/expectedVersion. Double tap, mất ACK và retry cùng attempt dùng nguyên key/payload; thay nội dung tạo attempt khác chỉ khi kết quả attempt cũ đã được giải quyết an toàn.

Baseline BE đề xuất replay response trong 24 giờ, sau đó giữ tombstone không tái tạo mutation và trả 410. UI phải giữ trạng thái EXPIRED để đối chiếu, không coi 410 hay 404 lookup submission là bằng chứng tin chưa được tạo. Key khác payload là conflict, không tự sửa key để vượt lỗi. Submission PROCESSING → chờ/backoff có giới hạn; SUCCEEDED → đọc kết quả/nguồn mới; FAILED → hiển thị lỗi đã xác nhận và cho sửa; EXPIRED → hướng dẫn đối chiếu Tin của tôi, không tự đăng lại. Polling chỉ khi cùng account/epoch, có cancel và retry giới hạn; không poll vô hạn ở background.

Sau lỗi mạng trước khi biết server nhận, reconcile cùng key rồi retry cùng attempt theo contract. Nếu đổi tài khoản, dừng toàn bộ reconciliation và không chuyển key/payload A sang B. Mutation PUT/transitions cũng dùng version và key để replay không áp lại nhiều lần. Replay (`Idempotency-Replayed: true`) có thể chứa snapshot cũ; sau xác nhận attempt, GET current owner listing để nạp version hiện tại, không ghi snapshot replay đè trạng thái mới. `Retry-After` phải được tôn trọng cho PROCESSING/rate-limit. Task runtime phải kiểm thử mất ACK sau commit, duplicate request đồng thời và key mismatch; fixture schema không chứng minh cơ chế DB này đã hoạt động.

## Interface draft và cleanup cho TASK-23

Draft adapter cung cấp `load(accountId, draftId)`, `save(accountId, draft)`, `remove(accountId, draftId)` và cleanup scope. Record có schemaVersion, accountId, draftId, loại tin, input chưa format, local asset reference, mediaId đã xác nhận, updatedAt và attempt snapshot `{key, operation, targetId?, expectedVersion?, payload, state}` khi có. Không có bearer, password, API secret hoặc trường cấp quyền.

TASK-23 chọn storage và chính sách phục hồi URI; không mặc định AsyncStorage/MMKV hay đồng bộ nhiều thiết bị. Save phải serialize theo account để ghi A đang chờ không xuất hiện trong draft B. Đăng ký xóa cache/draft/local media riêng qua account logout resources; cleanup lỗi phải báo thật và không giải phóng private UI như đã xóa thành công. Không xóa media server/public bằng cách global clear filesystem/storage; cleanup asset chưa gắn tin cần API/policy media đã chốt.

Khi server xác nhận create, ghi kết quả/đánh dấu consumed trước khi bỏ draft để tránh crash khôi phục rồi đăng lại. Nếu lưu kết quả local lỗi, ưu tiên reconcile cùng key khi mở lại; không tạo key mới. Chủ động xóa draft chưa gửi khác với attempt đang PROCESSING/unknown; muốn bỏ nội dung phải vẫn ngăn attempt cũ được gửi lại tự động.

## Lifecycle và nội dung hiển thị

| Server lifecycle | Hiển thị |
|---|---|
| OPEN | Đang mở (có thể dùng nhãn Đang hiển thị trong danh sách) |
| COMPLETED + SOLD / FOUND / EXCHANGED | Đã bán / Đã tìm được / Đã trao đổi, đúng type |
| CLOSED | Đã đóng, không tính giao dịch hoàn tất |
| REMOVED + OWNER / ADMIN | Đã gỡ; phân biệt quyết định quản trị khi có quyền xem |

Không suy ra completion từ type khi server chỉ trả CLOSED/REMOVED. Nút COMPLETE/CLOSE/REMOVE chỉ được bật theo quyền/state machine BE, mở dialog khác nhau; hủy không phát request. Không có tự mở lại/khôi phục tin admin gỡ trong v1. Lỗi mutation giữ trạng thái đã xác nhận trước đó. “Đã bán” là tự cập nhật của chủ tin, không là chứng nhận giao dịch/thanh toán của StudentMart.

TASK-07 đọc trạng thái này để refresh tìm kiếm/chi tiết/chat, ngăn hội thoại mới và tiếp tục hội thoại cũ theo quyền. #121 không thiết kế lại chat hoặc tuyên bố đã thực thi các quy tắc đó.

## Checklist triển khai và kiểm chứng tiếp theo

- Mapper/validation đủ ba loại, Unicode, tiền null/zero, field cấm, media chưa upload hoặc không thuộc owner.
- Form giữ dữ liệu khi lỗi; thay loại trước submit không âm thầm mất nhánh cũ; editor không đổi type; version conflict không overwrite.
- Retry same key sau timeout/ACK mất; same key khác payload, PROCESSING/FAILED/EXPIRED và 404 không tự repost.
- Native library picker/hủy, file không khả dụng, upload lỗi, Back/gesture/foreground, font scaling/safe area và text tiếng Việt.
- Auth 401/403, logout A→B, response/ghi draft A trễ, private cache/account scope; native SecureStore và storage thực kiểm tra riêng.
- Source mới hiện chỉ tài liệu: không có bằng chứng API tin đăng, DB integration, provider ảnh tin hoặc native screen hoạt động trong #123. Bằng chứng contract tổng được root/QA ghi trong PR của #121; không đánh Done từ schema/mock.
