# Danh mục món hàng và khu vực StudentMart

Ngày 2026-11-15, người dùng cho phép xây danh sách danh mục hợp lý cho sinh viên và khu vực quanh Làng Đại học. Nhánh `feat/student-marketplace-catalog` bắt đầu từ main sau PR #138.

## Phạm vi

- 16 danh mục đồ dùng sinh viên và 10 khu vực/địa điểm chung, dữ liệu thật trong PostgreSQL, không hardcode danh sách lựa chọn ở mobile.
- API công khai `/api/v1/catalog/listing-categories` và `/api/v1/catalog/areas` giữ contract hiện tại `{items: [{id,code,name}]}`.
- `Area` dùng chung cho hồ sơ và tin đăng. Không seed trường học vào bảng School, không cấp nhãn xác thực từ khu vực được chọn.
- Khu vực là lựa chọn thủ công gần địa danh, không phải GPS, địa chỉ riêng, chứng nhận nơi cư trú hoặc bảo đảm được phép vào khuôn viên/giao dịch ở đó.

Danh sách đầy đủ và nguồn xác minh địa điểm nằm ở [catalog](../catalog/student-marketplace-catalog.md).

## Review migration

`SeedStudentMarketplaceCatalog1794720000000` là migration dữ liệu, không đổi entity/schema. Không tạo migration schema rỗng. Hai vòng INSERT dùng UUID/code ổn định và `ON CONFLICT (code) DO NOTHING`; row đã có cùng code giữ nguyên ID/tên, bảo toàn references. Nếu UUID trùng row khác code, migration thất bại an toàn thay vì đổi dữ liệu người dùng.

Down từ chối revert để tránh xóa danh mục đã được tin/hồ sơ sử dụng hoặc xóa nhầm row có trước migration. Sửa catalog sau này dùng migration tiến mới được review; không tự xóa/reset database.

## Kiểm tra

`backend/tests/integration/student-catalog.test.ts` dùng NestJS/Fastify và PostgreSQL thật:

- Guest tải được hai catalog có chữ tiếng Việt, code không trùng và projection chỉ id/code/name.
- Có giáo trình, KTX A, Bách khoa và Khoa học Tự nhiên trong lựa chọn.
- Tạo tin Tìm mua với ID catalog đã seed thật, đọc lại dữ liệu đã lưu.
- Cập nhật khu vực hồ sơ bằng chính Area đó; dữ liệu catalog được giữ nguyên.
- Cleanup chỉ xóa Account/AuthSession/Listing/ListingMutation UUID fixture của test; không xóa catalog được seed, không truncate/reset hoặc tự apply migration trong test.

Lệnh focused từ root:

```powershell
pnpm.cmd --filter studentmart-backend exec vitest run tests/integration/student-catalog.test.ts
```

Kết quả migration/check và suite tổng được ghi sau khi thực thi. Unit/mock, HTTP/PostgreSQL, Expo export và thao tác thiết bị được báo riêng; native iOS/Android selection/keyboard/safe-area vẫn cần người dùng kiểm tra.

## K?t qu? focused QA

`pnpm.cmd --filter studentmart-backend exec vitest run tests/integration/student-catalog.test.ts`: **1/1 PASS** tr?n HTTP/PostgreSQL th?t sau khi BE apply seed migration. Backend x?c nh?n 9 migration ?? apply/kh?ng pending/schema kh?p; QA kh?ng t? apply/revert. Kh?ng c? provider/native test trong test n?y.

Review source selector FE: l?a ch?n l?y t? API, modal c? t?m ki?m kh?ng d?u, FlatList, nh?n accessibility, safe area v? x? l? loading/empty/error/retry; ??ng/h?y kh?ng ??i selection. ??y l? review source, ch?a ch?ng minh keyboard/VoiceOver tr?n iPhone ho?c Android th?t.
