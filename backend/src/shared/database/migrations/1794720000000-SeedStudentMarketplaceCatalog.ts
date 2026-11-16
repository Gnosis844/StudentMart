import type { MigrationInterface, QueryRunner } from "typeorm";

// Initial product catalog authorized by the user on 2026-11-15.
// Codes are stable identifiers. Existing rows (including their IDs/names) win.
export const initialListingCategories = [
  ["HOME_APPLIANCES", "Đồ điện gia dụng"],
  ["KITCHENWARE", "Đồ dùng nhà bếp"],
  ["ROOM_FURNITURE", "Nội thất và đồ dùng phòng trọ"],
  ["PHONES_TABLETS", "Điện thoại và máy tính bảng"],
  ["LAPTOPS_COMPUTERS", "Laptop và máy tính"],
  ["ELECTRONIC_COMPONENTS", "Linh kiện điện tử"],
  ["TECH_ACCESSORIES", "Phụ kiện công nghệ"],
  ["BOOKS", "Sách"],
  ["TEXTBOOKS_MATERIALS", "Giáo trình và tài liệu học tập"],
  ["STATIONERY_STUDY_TOOLS", "Văn phòng phẩm và dụng cụ học tập"],
  ["CLOTHING_ACCESSORIES", "Quần áo và phụ kiện"],
  ["BAGS_BACKPACKS", "Ba lô và túi xách"],
  ["SPORTS_EQUIPMENT", "Đồ thể thao"],
  ["MUSICAL_INSTRUMENTS", "Nhạc cụ"],
  ["BICYCLES_ACCESSORIES", "Xe đạp và phụ kiện"],
  ["OTHER_STUDENT_GOODS", "Đồ dùng khác"],
] as const;

export const initialMarketplaceAreas = [
  ["VNU_DORM_A", "Ký túc xá khu A"],
  ["VNU_DORM_B", "Ký túc xá khu B"],
  ["HCMUT_CAMPUS_2", "ĐH Bách khoa – Cơ sở 2"],
  ["HCMUT_CAMPUS_2_SPORTS_HALL", "Nhà thi đấu ĐH Bách khoa – Cơ sở 2"],
  ["HCMUS_LINH_TRUNG", "ĐH Khoa học Tự nhiên – Cơ sở Linh Trung"],
  ["UIT_CAMPUS", "ĐH Công nghệ Thông tin"],
  ["IU_CAMPUS", "ĐH Quốc tế"],
  ["USSH_LINH_XUAN", "ĐH KHXH&NV – Cơ sở Linh Xuân"],
  ["UEL_CAMPUS", "ĐH Kinh tế–Luật"],
  ["VNU_STUDENT_CULTURAL_HOUSE", "Nhà Văn hóa Sinh viên – ĐHQG-HCM"],
] as const;

export class SeedStudentMarketplaceCatalog1794720000000 implements MigrationInterface {
  name = "SeedStudentMarketplaceCatalog1794720000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [index, [code, name]] of initialListingCategories.entries()) {
      await queryRunner.query(
        'INSERT INTO "ListingCategory" ("id", "code", "name") VALUES ($1, $2, $3) ON CONFLICT ("code") DO NOTHING',
        [`c37a0000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, code, name],
      );
    }
    for (const [index, [code, name]] of initialMarketplaceAreas.entries()) {
      await queryRunner.query(
        'INSERT INTO "Area" ("id", "code", "name") VALUES ($1, $2, $3) ON CONFLICT ("code") DO NOTHING',
        [`a37a0000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, code, name],
      );
    }
  }

  async down(): Promise<void> {
    // Never remove live lookup data or accidentally delete a pre-existing row.
    // Changes to this published catalog require a new forward migration.
    throw new Error("Catalog data is forward-only; use a reviewed forward migration to preserve listing/profile references.");
  }
}
