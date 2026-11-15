# TASK-04.01 — Đối chiếu ảnh thiết kế tin đăng (#123)

Ngày review 2026-11-14. Đã mở trực tiếp bốn PNG local bằng `view_image`; không truy cập file Figma hoặc chạy màn hình native. Source tham chiếu được người dùng chỉ định là thư mục `design/`. Các khung bị cắt phía dưới là viewport ảnh, không bằng chứng rằng field ngoài viewport tồn tại.

| Ảnh đã xem | Nội dung nhìn thấy |
|---|---|
| [Đăng/Tin của tôi/Sửa](<../../design/Pasted 2026-11-13 at 12.51.05 PM.png>) | Ba tab loại tin; title, category, giá bán, mô tả, khu ảnh; form sửa mẫu và CTA; danh sách của tôi với tab Đang hiển thị/Đã đóng/Đã hoàn tất, nút Chỉnh sửa/Đóng tin/Xóa tin |
| [Khám phá/Lọc/Chi tiết](<../../design/Pasted 2026-11-13 at 12.51.35 PM.png>) | Tin Bán, Tìm mua có ngân sách, Trao đổi; category/area/price filter; ảnh/giá/trạng thái/CTA liên hệ chi tiết |
| [Chat](<../../design/Pasted 2026-11-13 at 12.52.02 PM.png>) | Hội thoại có context card ảnh/title/giá/trạng thái tin; chỉ dùng để nhận diện dependency TASK-07, không mở rộng phạm vi #121 |
| [Design system](<../../design/Pasted 2026-11-13 at 12.42.04 PM.png>) | Palette cam/trung tính, typography Inter, spacing/radius, button/input/card/chip/badge và navigation; chú thích contrast cam gốc chưa đạt AA cho chữ trắng |

## Mapping và các chỗ cần bổ sung

| Chi tiết thiết kế | Contract / kết luận |
|---|---|
| Tab Tin bán / Tìm mua / Trao đổi | `type: SELL/BUY/EXCHANGE` khi tạo. Cần frame đầy đủ BUY và EXCHANGE; ảnh đang mở chỉ expand SELL |
| Tên sản phẩm hoặc món đồ | `title`; phù hợp cả món cần tìm. Giới hạn đề xuất 10–120 code point khớp ví dụ lỗi “ít nhất 10 ký tự” của design system; vẫn cần người dùng review giới hạn trước runtime |
| Danh mục | `categoryId` UUID từ catalog được duyệt. Sáu tên category mẫu trong ảnh browse không là dataset/ID được phép seed |
| Giá bán 85.000đ | SELL `price` nguyên VND; UI định dạng hàng nghìn, không gửi ký tự đ/dấu nhóm. BUY dùng budget nullable; EXCHANGE dùng nội dung muốn đổi, không tự thêm giá bắt buộc |
| Mô tả sản phẩm | `description`; bổ sung label theo loại, khuyết điểm có thể mô tả. Không thấy field condition trong viewport: cần UI cụ thể cho SELL/EXCHANGE |
| Khu ảnh | Ordered mediaIds, local/đang tải/lỗi/đã xác nhận tách biệt. Giới hạn đề xuất 8 ảnh, 10 MiB/ảnh, 24 megapixel và mỗi chiều ≤12000px phải review riêng; ảnh thiết kế không nêu giới hạn. BUY không bắt buộc ảnh |
| Khu vực | Area không thấy trong phần composer ảnh đang hiển thị; cần field chọn thủ công được hỗ trợ, không GPS hay suy ra từ hồ sơ mẫu |
| Chỉnh sửa vẫn hiện tab loại tin | Baseline API v1 đề xuất type bất biến sau create. Hiển thị read-only/disabled với giải thích; không cho đổi type chỉ vì khung mẫu có chips |
| Danh sách có nút Xóa tin | Map về REMOVE/Đã gỡ, không mặc định hard delete row/tài khoản/hội thoại; cần dialog giải thích và nhãn thống nhất với contract |
| Đóng tin không đồng nghĩa hoàn tất | Chú thích ảnh phù hợp UF02b. Cần thao tác COMPLETE riêng trong editor/management với nhãn theo loại và confirmation; chưa thấy thao tác hoàn tất trong viewport |
| Tab Đã hoàn tất | Render nhãn Đã bán/Đã tìm được/Đã trao đổi từ lifecycle; không gộp đóng/gỡ thành completion. Thiếu nhóm hiển thị REMOVED/quyền hạn chế; cần bổ sung ở #132 |
| Ảnh sách, tên, giá, khu vực và danh sách mẫu | Chỉ minh họa, không được hardcode thành dữ liệu runtime hoặc source catalog. Không thêm thống kê từ số card trong ảnh |
| Badge trong chat/chi tiết | State nguồn BE, do #8 đồng bộ. Không coi context card mẫu chứng minh chat hoặc lifecycle refresh đã hoạt động |

## Trạng thái chưa được ảnh mô tả đủ

- Loading catalog/list/editor; empty khác lỗi tải; retry mạng và quyền ảnh; ảnh chưa đọc được, sai định dạng, quá lớn hoặc upload dở.
- Field errors cho cả ba loại; budget trống, null khác zero; title/description Unicode và giới hạn dài; lookup bị ngừng hỗ trợ.
- Server chưa ACK, timeout có thể đã lưu, same-attempt reconciliation, conflict version và duplicate submission.
- Xác nhận rời form/giữ draft, ảnh local tồn tại sau mở lại, logout/A→B và bỏ phản hồi cũ.
- COMPLETE/CLOSE/REMOVE dialog riêng, account bị hạn chế, owner không phải chủ tin, admin removed không tự khôi phục.
- Safe area, keyboard, font scaling, screen reader, focus lỗi và vùng chạm trên iOS/Android; ảnh tĩnh không chứng minh các hành vi này.

## Quy tắc khi triển khai UI

Dùng palette/spacing nhất quán; bổ sung màu chữ/nền tương phản đạt AA thay vì sao chép cặp cam gốc/chữ trắng đã được design system cảnh báo. Nhãn lỗi/trạng thái có text, không chỉ màu. Dùng React Native primitives/StyleSheet, không áp CSS/DOM từ thư viện web. Inter là font trong ảnh, chưa có dependency font ở manifest; dùng system font hỗ trợ tiếng Việt hoặc bổ sung font qua ticket riêng có kiểm tra, không báo đã dùng Inter khi chưa cài.

Navigation ảnh có naming Trang chủ/Danh mục/Tin nhắn; app/context dùng Khám phá/Tin của tôi/Hộp thư theo chức năng đã triển khai. Chốt mapping với navigation thực ở ticket runtime, không thêm tab giả dẫn tới dữ liệu demo. Các khung create/editor/my listings chỉ là reference; #123 không sửa App.tsx, không cài router/UI kit và không tạo màn hình.

## Bằng chứng và review gate

Đầu ra là mapping field/state và danh sách chênh lệch so với [hợp đồng mobile](listing-mobile.md), [OpenAPI](listings.openapi.yaml). Giới hạn số ảnh/dung lượng/độ dài, loại tin bất biến và semantics REMOVE là baseline đề xuất để người dùng review PR trước code. Chưa nghiệm thu pixel trên thiết bị, picker/upload thật cho tin đăng, database hoặc luồng mobile–API–PostgreSQL; các bước đó thuộc #124–#135. Không đánh Done chỉ vì ảnh/source tài liệu đã được xem.
