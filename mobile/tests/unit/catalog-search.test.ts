import { describe, expect, it } from "vitest";
import { filterCatalog } from "../../src/features/listings/business/catalog-search";

const choices = [
  { id: "textbooks", name: "Giáo trình, tài liệu học tập" },
  { id: "electronics", name: "Thiết bị và linh kiện điện tử" },
  { id: "dorm-a", name: "Ký túc xá khu A" },
  { id: "dorm-b", name: "Ký túc xá khu B" },
];

describe("catalog search", () => {
  it("finds Vietnamese names with or without diacritics and any letter case", () => {
    expect(filterCatalog(choices, "DIEN TU")).toEqual([choices[1]]);
    expect(filterCatalog(choices, "GIÁO TRÌNH")).toEqual([choices[0]]);
  });
  it("requires all query words and ignores spacing", () => {
    expect(filterCatalog(choices, "  khu   B ")).toEqual([choices[3]]);
    expect(filterCatalog(choices, "khu khong-ton-tai")).toEqual([]);
  });
  it("preserves server IDs/order and never mutates the server array", () => {
    const before = JSON.stringify(choices);
    expect(filterCatalog(choices, "   ")).toEqual(choices);
    expect(filterCatalog(choices, "ky tuc").map(c => c.id)).toEqual(["dorm-a", "dorm-b"]);
    expect(JSON.stringify(choices)).toBe(before);
    expect(filterCatalog([], "dien")).toEqual([]);
  });
});
