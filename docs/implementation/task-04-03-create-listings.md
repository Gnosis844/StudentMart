# TASK-04.03 — Tạo tin ba loại (#127/#128/#129)

Nhánh `feat/127-create-listings` bắt đầu từ main có contract #121 và media #124. BE phụ trách schema/API, FE form mobile và QA kiểm tra xuyên qua production mobile model/repository → HTTP NestJS → PostgreSQL. Không dùng trạng thái đóng của issue để kết luận nguồn runtime đã có.

## Đối chiếu nghiệm thu

| Tiêu chí | Bằng chứng | Giới hạn |
|---|---|---|
| Bán, Tìm mua, Trao đổi được lưu | POST thật, đọc lại own listing; Bán/Trao đổi có media, Tìm mua không ảnh và budget null | Không giả ngân sách trống là 0/miễn phí |
| Owner từ phiên, chưa verify vẫn đăng | Fixture MEMBER UNVERIFIED tạo cả ba loại; query/body không thay được owner; B đọc riêng A trả 404 | Không seed tài khoản/dữ liệu giả vào production |
| Whitelist và dữ liệu hợp lệ | Reject ownerId/role/status; lookup sai, thiếu ảnh bắt buộc và media B/hết hạn bị từ chối | Media test là staged fixture, không phải upload Cloudinary mới |
| Nguyên tử Listing/ảnh | Lỗi lookup/media không để Listing dở hoặc gắn ảnh own bị lỗi; sau thành công media ATTACHED | Concurrent media và recovery được BE kiểm tra riêng nếu có, không suy từ schema |
| Retry không tạo bản sao | Hai POST đồng thời cùng key, payload đảo thứ tự property, replay header, mismatch 409; chỉ một Listing | Dùng HTTP thật, không chỉ mock create service |
| Tombstone và đối chiếu | 404 unknown/khác account, expired key 410, GET known expired giữ reference | Test cập nhật replayUntil fixture để kiểm tra expiry; không cần chờ 24 giờ |
| Mất ACK giữ cùng lần gửi | Model production nhận lỗi sau server commit; submit tiếp reconcile GET tin hiện tại; newKey chỉ gọi một lần | Transport adapter mô phỏng mất response, server/DB vẫn thật |
| Không lẫn A → B | Reset draft sau logout/login B; response create A thực bị giữ tới sau login B rồi bỏ qua | CredentialStore memory adapter; không chứng minh SecureStore/thiết bị |
| Quyền hiện tại | Thiếu session 401; session hết hạn thực trong PostgreSQL trả 401 SESSION_EXPIRED; account bị hạn chế 403 | Không suy rằng OTP/verify là điều kiện đăng tin |
| UI và thiết kế | Composer FE và picker dùng contract; loading/error/validation và confirmed outcome được review/test FE | Cần kiểm tra keyboard/safe area/font scaling và thao tác trên iOS/Android |

## Dữ liệu và migration

Migration `AddListingCreation1794710883065` được sinh từ entity và BE review/apply. Up tạo ListingCategory, Listing, ListingImage, ListingMutation cùng CHECK/index/FK; down xóa các bảng mới và dữ liệu trong đó, không được tự revert. BE xác nhận 8 migration đã apply, none pending, schema khớp. QA không tự migrate/reset database.

Fixture test tạo UUID/email `@example.invalid`, category/area tổng hợp có nhãn QA và media URL `example.invalid`. Cleanup chỉ xóa image/mutation/media/listing/account/catalog có UUID của lượt thử; không truncate/reset, không chạy cleanup provider toàn cục. Không có Cloudinary credentials/ảnh thật trong fixture.

Danh mục/khu vực dùng catalog runtime. Nếu chưa có dataset được duyệt, form báo thiếu nguồn và không tự tạo danh mục thay thế. Việc fixture test chèn catalog tổng hợp không phải seed production hoặc chứng minh đã có dữ liệu phục vụ người dùng.

## Bằng chứng chạy

Lệnh từ root:

```powershell
pnpm.cmd --filter studentmart-backend exec vitest run tests/integration/mobile-listing-create.test.ts
```

Ngày 2026-11-15, focused HTTP/PostgreSQL **5/5 PASS**. Bao gồm request BUY với 5000 emoji (vượt 16 KiB nhưng đúng 5000 Unicode code point), replay FAILED cùng key, expired session thật và durable expiry outcome. Bộ test dùng production auth API/coordinator và listing-create model/repository, không import native picker vào Node.

Root ghi nhận suite tổng **36 integration PASS**, **246 contract/unit PASS** và typecheck PASS tại source tổng hợp; kiểm tra Expo cuối được ghi ở PR khi FE hoàn tất. Những kiểm tra tự động này không thay bằng chứng thiết bị/catalog production.

Review source QA phát hiện App còn render placeholder dù đã import composer; FE sửa render `ListingComposeScreen` và `OwnListingScreen`, QA kiểm tra lại nhánh thực tế. Model khóa chỉnh sửa/media khi uncertain, giữ cùng key/payload cho unknown, không tự thử key mới sau expiry; foreground compose revalidate cùng epoch giữ draft. Việc nối nút thật được rà source riêng, không suy từ test model.

## Ranh giới và checklist còn lại

- [ ] Thiết bị iOS/Android: chọn loại tin, nhập tiếng Việt, chọn ảnh, gửi và mở lại tin đã lưu.
- [ ] Mất mạng/foreground/Back không mất input, lỗi hiển thị rõ; gửi lại không nhân bản.
- [ ] Dataset catalog được duyệt đã được cung cấp cho môi trường thật.
- [ ] Search/feed/public detail/chat tích hợp ở TASK-05/06/07; create/own-read không có nghĩa các module đó đã triển khai.
- [ ] Draft persistence qua app kill thuộc TASK-23; task này có interface và trạng thái account-scoped, không khẳng định đồng bộ nhiều thiết bị.

PR chờ người dùng review/approve; không tự merge/đóng issue/Done khi thiếu bằng chứng nghiệm thu. `.agents/` và `.github/` giữ local, không track; không tuyên bố CI tự động đã pass.
