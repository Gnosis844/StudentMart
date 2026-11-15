# TASK-04.02 — Ảnh tin đăng (#124/#125/#126)

Nhánh `feat/124-listing-media`, từ main đã merge contract #121/PR #136. Phạm vi là staged media và component dùng lại cho composer/editor; không tạo Listing API giả để nghiệm thu task đăng tin.

## Ma trận nghiệm thu

| Tiêu chí | Bằng chứng | Giới hạn |
|---|---|---|
| Media riêng, không dùng avatar | POST `/api/v1/listing-media`, DELETE theo UUID; Cloudinary namespace riêng và ListingMedia | Listing thật chưa tồn tại |
| Nội dung file hợp lệ | HTTP multipart thật: PNG được sharp decode/re-encode, fake bytes/MIME giả/chiều rộng quá giới hạn bị 415, quá 10 MiB bị 413 | Chưa phải thao tác picker native |
| Chỉ owner xử lý media | Query ownerId không đổi actor; B không xóa media A (404); private projection chỉ có id/url/width/height/expiresAt | Kiểm tra quyền gắn vào Listing thực nằm ở #127/#130 |
| Upload lỗi giữ dữ liệu trước | Provider adapter lỗi trả 503; staged media đã có giữ nguyên | Provider adapter không chứng minh Cloudinary thật |
| Quota | 32 pending media/account; request thứ 33 trả 429/Retry-After, tài khoản khác vẫn upload; dọn một fixture rồi upload được | Đây là giới hạn vận hành bảo vệ upload staging, khác tối đa 8 ảnh/tin |
| Atomic attachment port | Transaction gắn media A cùng media B bị rollback; attachment hợp lệ chặn DELETE 409; expired media bị từ chối | listingId trong test là UUID tham chiếu cho port, không phải Listing đã lưu |
| Cleanup không đụng ảnh liên kết | Media DELETING giữ intent khi provider destroy lỗi, retry scoped cleanupOne chuyển DELETED; ATTACHED giữ nguyên | Không chạy global cleanup trên DB người dùng trong test; scheduler/command và transaction Listing thật cần nghiệm thu khi tích hợp |
| Mobile cancel/retry/thứ tự | Production model/auth qua HTTP thật, cancel không thêm ảnh; upload lỗi giữ asset, retry thành công; reorder phản ánh mediaIds; remove sau ACK | Node transport chuyển URI fixture thành bytes, không phải native File trên điện thoại |
| Logout/A→B | Giữ phản hồi upload A thật đến sau logout/login B: model B rỗng, không lẫn ảnh A | CredentialStore test là adapter memory |
| Chỉ dùng media đã xác nhận | Model phân biệt local/uploading/confirmed/error, `confirmedIds` từ chối ảnh chưa sẵn sàng/hết hạn | Composer tạo tin và draft persistence còn ở #127/#130/#24 |
| Giao diện và source UTF-8 | QA phát hiện thông báo bị thay bằng `?`, FE đã sửa; source hiện có tiếng Việt đúng dấu | Native keyboard/safe area/accessibility cần thiết bị |

## Kiểm thử QA đã chạy

Ngày 2026-11-15, từ root:

```powershell
pnpm.cmd --filter studentmart-backend exec vitest run tests/integration/mobile-listing-media.test.ts
```

**4/4 PASS** trên HTTP/PostgreSQL thật, sau migration ListingMedia đã được BE apply. Test dùng account UUID/email `example.invalid`, chỉ xóa Account/AuthSession/ListingMedia thuộc fixture. Không reset/truncate DB, không tự apply/revert migration, không gọi global cleanup ảnh của người dùng.

QA phát hiện lỗi cleanup dùng `listingId: undefined` trong update criteria, bị TypeORM từ chối rồi exception bị giữ như lỗi provider. BE sửa thành `IsNull()`; test cleanup retry bảo vệ lỗi này.

Migration `AddListingMedia1794708894334`: BE xác nhận đã generate/review/apply; database `student-mart` có 7 migration đã áp dụng, none pending, schema khớp. Test chỉ sử dụng schema đã có. Migration tạo bảng và down xóa bảng sẽ mất dữ liệu media; QA không chạy down.

Root/BE/FE bổ sung kết quả bộ kiểm tra tổng, Cloudinary smoke và Expo ở PR. Không suy ra full suite đã pass từ focused run.

## Phân biệt môi trường và việc còn chờ

- HTTP/PostgreSQL và model dùng source production là thật; provider `ListingMediaStorage` tiêm phụ thuộc trả URL `cdn.example.invalid`. Đây không phải bằng chứng upload lên Cloudinary thật.
- BE có thể smoke Cloudinary thật bằng asset/account tạm và cleanup; bằng chứng phải ghi riêng, không xuất credential.
- `.agents/` và `.github/` giữ local/ignore, không lấy thiếu GitHub Actions làm CI pass.
- #127/#130 phải gọi attach/detach trong cùng transaction Listing, kiểm tra ownership/version/trạng thái và toàn bộ danh sách ảnh. Chưa có Listing thật nên chưa nghiệm thu end-to-end gắn/thay/xóa ảnh cùng nội dung tin.
- #24 sở hữu draft bền vững/phục hồi; staged media hết hạn sau 24 giờ không phải cam kết draft nhiều thiết bị.

## Checklist thiết bị còn pending

- [ ] iPhone/Android: picker quyền/hủy, JPEG/PNG/WebP, file lớn/không hỗ trợ; không có camera/microphone.
- [ ] Preview, đổi thứ tự, upload lỗi rồi retry, xóa và giữ ảnh khi lỗi; chỉ media đã server xác nhận được dùng.
- [ ] Foreground/picker return không mất lựa chọn; logout/login B không hiện ảnh A; Back giữ đúng ngữ cảnh.
- [ ] Tiếng Việt, font scaling, safe area, screen reader và vùng chạm; export bundle không thay native acceptance.

PR chờ review/approve; không tự merge hoặc đánh Done toàn bộ tiêu chí khi integration Listing/native còn pending.
