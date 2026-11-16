# Danh mục và khu vực StudentMart ban đầu

Ngày 2026-11-15, người dùng cho phép lựa chọn danh mục phù hợp sinh viên và các khu vực quanh Làng Đại học ĐHQG-HCM. Bộ dữ liệu này là dữ liệu sản phẩm thật, không phải fixture demo. Nó phục vụ API danh mục tin đăng, khu vực đăng tin và khu vực hồ sơ hiện có. Không thêm dữ liệu trường tự khai hoặc nhãn xác thực.

## Danh mục đồ dùng

16 nhóm: Đồ điện gia dụng; Đồ dùng nhà bếp; Nội thất và đồ dùng phòng trọ; Điện thoại và máy tính bảng; Laptop và máy tính; Linh kiện điện tử; Phụ kiện công nghệ; Sách; Giáo trình và tài liệu học tập; Văn phòng phẩm và dụng cụ học tập; Quần áo và phụ kiện; Ba lô và túi xách; Đồ thể thao; Nhạc cụ; Xe đạp và phụ kiện; Đồ dùng khác.

Đây là taxonomy do StudentMart chọn theo nhu cầu sinh viên; tham khảo cách nhóm [đồ điện tử Chợ Tốt](https://www.chotot.com/do-dien-tu) và [phạm vi ngành hàng](https://press.chotot.com/about/), không sao chép toàn bộ danh mục của nền tảng đó. Không mở thêm bất động sản, tuyển dụng, động vật hoặc dịch vụ ngoài phạm vi đồ dùng C2C của ứng dụng. Danh mục chỉ mô tả loại món đồ, không phải chứng nhận hàng hóa đủ điều kiện giao dịch.

## Khu vực hỗ trợ ban đầu

Tên là khu vực chung để sinh viên tự chọn, không phải địa chỉ hẹn chính xác, vị trí GPS hoặc cam kết được vào cơ sở. Không lưu số phòng/địa chỉ riêng; hai bên tự thỏa thuận nơi gặp phù hợp.

| Khu vực | Nguồn tham chiếu |
|---|---|
| Ký túc xá khu A; Ký túc xá khu B | [Khu đô thị ĐHQG-HCM](https://vnuhcm.edu.vn/khu-do-thi) |
| ĐH Bách khoa – Cơ sở 2 | [Cổng thông tin HCMUT](https://portal.hcmut.edu.vn/) |
| Nhà thi đấu ĐH Bách khoa – Cơ sở 2 | [Thời khóa biểu ĐH Quốc tế có địa điểm nhà thi đấu](https://edusoftweb.hcmiu.edu.vn/Upload/TB%20TKB%20HK2%20cua%20SV%20K22_Trinh%20BGH%20-%20%5BVB_713_1498%5D.pdf) |
| ĐH Khoa học Tự nhiên – Cơ sở Linh Trung | [Cơ sở vật chất Khoa CNTT HCMUS](https://www.fit.hcmus.edu.vn/beta/gioi-thieu/co-so-vat-chat) |
| ĐH Công nghệ Thông tin | [UIT](https://cd.uit.edu.vn/) |
| ĐH Quốc tế | [Thông tin cơ sở học ĐH Quốc tế](https://edusoftweb.hcmiu.edu.vn/default.aspx?id=1303&page=chitietthongtin) |
| ĐH KHXH&NV – Cơ sở Linh Xuân | [Tên gọi cơ sở Linh Xuân](https://hcmussh.edu.vn/bai-viet/thong-bao-dieu-chinh-ten-goi-cong-trinh-va-so-hieu-phong-hoc-tai-co-so-linh-xuan) |
| ĐH Kinh tế–Luật | [Tuyển sinh UEL](https://tuyensinh.uel.edu.vn/) |
| Nhà Văn hóa Sinh viên – ĐHQG-HCM | [Giới thiệu Nhà Văn hóa Sinh viên](https://www.nhavanhoasinhvien.vn/tong-quan-ve-nvhsv) |

Không gắn tên phường/thành phố vào label vì tên hành chính có thể thay đổi; dùng tên địa điểm/cơ sở để nhận diện. Bộ dữ liệu không bao phủ mọi khu vực hay cơ sở đào tạo trong vùng.

## Migration và vận hành

`SeedStudentMarketplaceCatalog1794720000000` là migration **dữ liệu**, không đổi entity/schema. Vì entity không thay đổi, TypeORM schema diff không thể sinh các INSERT này; file được viết thủ công có chủ đích, review và apply bằng `scripts/up.ps1`, kiểm tra bằng `scripts/check.ps1`. Giữ `synchronize: false`, `migrationsRun: false`.

- UUID mặc định và code ổn định; nếu code đã có, `ON CONFLICT (code) DO NOTHING` giữ nguyên ID và tên đang dùng. Không update hoặc truncate catalog hiện hữu.
- Không thay ID của danh mục/khu vực đã được Listing hoặc Account tham chiếu. Trùng UUID với code khác làm transaction thất bại thay vì ghi đè.
- `down` từ chối xóa dữ liệu: không thể phân biệt một row có từ trước với row migration tạo rồi đã được dùng. Muốn đổi/thu hồi danh mục cần forward migration riêng được review; không revert seed đang phục vụ dữ liệu thật.
- API `GET /api/v1/catalog/listing-categories` và `GET /api/v1/catalog/areas` vẫn trả `{items:[{id,code,name}]}`, sắp tên rồi ID. Mobile phải đọc ID từ API, không hardcode UUID.
- Checkout/database mới nhận dữ liệu qua migration bình thường; không cần một lệnh seed bí mật ngoài quy trình setup.

## Bằng chứng backend

Migration đã apply vào `student-mart` ngày 2026-11-15. Kiểm tra lại ngày 2026-11-16: backend typecheck/build PASS; `scripts/check.ps1` xác nhận 9 migration đã apply, không pending, schema khớp entity. Không apply lại hoặc revert trong lần kiểm tra tiếp tục.

`catalog-seed.test.ts` chạy PostgreSQL thật kiểm tra 16 danh mục/10 khu vực đã có; gọi lại phần INSERT dữ liệu hai lần trong transaction rồi rollback, chứng minh không đổi ID/tên đang được quản lý và không nhân đôi dữ liệu. Test cũng kiểm tra `down` từ chối xóa. Focused test 1/1 PASS; backend unit 28/28 PASS. Các test HTTP/form và kiểm thử native được ghi riêng trong bằng chứng tích hợp, không suy từ test seed.
