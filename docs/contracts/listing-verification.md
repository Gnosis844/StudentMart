# TASK-04.01 — Kiểm chứng hợp đồng tin đăng (#121/#122/#123)

Phạm vi: review contract cho R02–R04/R08, US02–US04/US08, UF02a/UF02b. Nguồn gồm issue #121/#122/#123, Wiki User Stories/Critical User Flows, source hiện tại và các tài liệu listing cùng thư mục. Đây là đặc tả để triển khai các task sau; không chứng minh API tin đăng đã chạy.

## Phương pháp kiểm tra

`tests/contracts/listing-contract.test.cjs` dùng Node test runner, YAML 2.9.1, Ajv 8.20.0 và ajv-formats hiện có, không cài framework mới. Fixture tổng hợp chỉ phục vụ validation; UUID/category/area/image URL trong test không phải dataset được duyệt hoặc dữ liệu Cloudinary thực.

Lệnh từ root PowerShell:

```powershell
node --test tests/contracts/listing-contract.test.cjs
pnpm.cmd test:contracts
git diff --check
```

## Ma trận yêu cầu → bằng chứng

| Yêu cầu | Kiểm tra contract | Giới hạn thực thi |
|---|---|---|
| Ba loại tin khác nhau | Input SELL/BUY/EXCHANGE, whitelist, field bắt buộc và nhánh không tương thích | Chuẩn hóa input/validation server còn cần triển khai |
| Tìm mua có thể bỏ ngân sách và ảnh | UX bỏ ngân sách serialize thành `budget: null`, `mediaIds: []`; schema chấp nhận, không biến null thành giá 0 | Mapper và hiển thị trên điện thoại chưa triển khai |
| Bán/Trao đổi cần ảnh | Không chấp nhận mảng ảnh rỗng; ID UUID và không lặp | Media tồn tại, đã giải mã, đúng owner/lookup được duyệt cần HTTP/DB tests sau |
| Giới hạn Unicode/tiền/ảnh | Test biên code point, integer VND, âm/phân số/vượt giới hạn | Các giới hạn là đề xuất PR cần review, không phải quyết định sản phẩm đã được duyệt |
| Hoàn tất khác đóng/gỡ | Schema lifecycle không cho CLOSED/OPEN mang completion, REMOVED phải có actor; không có action REOPEN | Transition theo trạng thái cũ và quyền owner/admin không chứng minh bằng JSON Schema |
| Optimistic concurrency | Full update và transition cần `expectedVersion >= 1` | So khớp version nguyên tử/concurrent writes cần DB tests |
| Retry không tạo trùng | Mutation có Idempotency-Key UUID bắt buộc; review quy tắc actor/key/canonical payload và reconciliation | Không chạy request mất ACK, replay hoặc kiểm tra durable tombstone trong task contract |
| Submission nhất quán | SUCCEEDED phải có ID/version và không lỗi; PROCESSING không có kết quả; FAILED có lỗi/không kết quả; EXPIRED không cho reference dở một nửa | Schema không chứng minh outcome thực đã commit; cần recovery/integration test ở runtime |
| HTTP metadata | Success riêng/mutation có Cache-Control no-store; key header bắt buộc, catalog được đọc guest, mọi ref/component resolve | Không chứng minh header hoặc guard thực đã hoạt động |
| Không lộ dữ liệu riêng | Listing/owner projection từ chối email, hash, token, địa chỉ và storage reference ngoài whitelist | Không chứng minh authorization/projection runtime trước khi API tồn tại |
| Phân trang | Page luôn có nextCursor, null khi hết trang, giới hạn items | Cursor signing/snapshot/account binding cần integration tests |
| Phiên, logout và A→B | Review yêu cầu account-scoped draft/submission key và bỏ phản hồi phiên cũ ở mobile contract | Chưa chạy native storage, draft persistence hoặc đổi tài khoản cho tin đăng |
| Ranh giới task | TASK-04 cung cấp dữ liệu/trạng thái, #8 sở hữu đồng bộ tìm kiếm/chat; #24 sở hữu draft bền vững | Không giả domain chưa có để đánh dấu tích hợp hoàn tất |

## Chưa kiểm tra runtime trong task này

- Không tạo/apply migration, entity hoặc controller listing, không thay database.
- Không thực hiện HTTP/PostgreSQL integration mới cho tin đăng, không kiểm tra provider ảnh tin đăng hoặc retry thật.
- Không dựng UI, export bundle hay thao tác iOS/Android cho tin đăng; review ảnh thiết kế là bằng chứng tham chiếu, không thay kiểm thử thiết bị.
- Không chứng minh dữ liệu category/area được duyệt, quyền quản trị, chat/search hoặc phân vùng draft bằng các fixture schema.
- Không tự merge, đóng issue hoặc chuyển Done; PR chờ người dùng review/approve, bao gồm các giới hạn đề xuất và quyết định contract.

## Kết quả đã chạy

Ngày kiểm tra 2026-11-15 (Asia/Saigon), Node/pnpm theo manifest hiện tại:

- `node --test tests/contracts/listing-contract.test.cjs`: **65/65 PASS**.
- `pnpm.cmd test:contracts`: **119/119 PASS**, gồm 54 account contract và 65 listing contract.
- `git diff --check`: PASS cho hai file QA sở hữu; cảnh báo LF/CRLF ở README thuộc thay đổi khác không phải lỗi whitespace.

Cross-review phát hiện và phối hợp sửa: title tối thiểu 10 code point đồng bộ ảnh thiết kế/BE/FE; Cache-Control từ mô tả prose thành header machine-readable; SubmissionStatus từ object lỏng thành các nhánh strict để loại outcome mâu thuẫn. Test biên đã bảo vệ những thay đổi này. Các giới hạn mới vẫn được ghi là đề xuất chờ review; không coi kết quả validator là phê duyệt chính sách.

Kiểm tra typecheck/unit tổng của root được ghi trong PR; không suy ra kết quả từ focused schema test. Không cần database/native/export mới để kiểm chứng thay đổi chỉ có contract/test này; các phần runtime được nêu ở checklist trên vẫn chưa được triển khai bởi #121.
