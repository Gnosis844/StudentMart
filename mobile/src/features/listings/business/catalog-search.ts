export type CatalogChoice = { id: string; name: string };

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
}

// Keep server ordering and IDs intact; search is only a presentation filter.
export function filterCatalog(items: readonly CatalogChoice[], query: string): CatalogChoice[] {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return items.filter(item => terms.every(term => searchable(item.name).includes(term)));
}
