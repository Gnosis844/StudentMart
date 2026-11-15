import { AuthError } from "../../auth/business/auth";
export const MAX_LISTING_IMAGES = 8;
export const MAX_LISTING_IMAGE_BYTES = 10 * 1024 * 1024;
export type ListingImageAsset = { uri: string; name: string; mimeType: string; size?: number; width?: number; height?: number };
export type ListingMedia = { id: string; url: string; width: number; height: number; expiresAt: string };
export type ListingMediaRepository = { upload(asset: ListingImageAsset): Promise<ListingMedia>; remove(id: string): Promise<void> };
export function imageError(asset: ListingImageAsset): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)) return "Chọn ảnh JPEG, PNG hoặc WebP.";
  if (asset.size !== undefined && (asset.size <= 0 || asset.size > MAX_LISTING_IMAGE_BYTES)) return "Mỗi ảnh cần lớn hơn 0 và tối đa 10 MiB.";
  if (asset.width !== undefined && asset.height !== undefined && (asset.width > 12000 || asset.height > 12000 || asset.width * asset.height > 24000000)) return "Ảnh tối đa 24 megapixel và mỗi chiều không quá 12000 px.";
  return null;
}
export function parseListingMedia(value: unknown): ListingMedia {
  const v = value as Partial<ListingMedia> | null;
  if (!v || typeof v !== "object" || typeof v.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)
    || typeof v.url !== "string" || !/^https:\/\//.test(v.url) || !Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width! < 1 || v.height! < 1
    || typeof v.expiresAt !== "string" || !Number.isFinite(Date.parse(v.expiresAt))) throw new AuthError("INVALID_RESPONSE", "Máy chủ chưa xác nhận ảnh hợp lệ.");
  return { id: v.id, url: v.url, width: v.width!, height: v.height!, expiresAt: v.expiresAt };
}
