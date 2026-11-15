import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as ImagePicker from "expo-image-picker";
import type { AuthCoordinator } from "../../auth/business/auth-coordinator";
import { AuthError } from "../../auth/business/auth";
import { avatarAssetFromPicker } from "../../profile/business/avatar-asset";
import { MAX_LISTING_IMAGE_BYTES, type ListingImageAsset } from "../business/listing-media";
import { createListingMediaRepository } from "./listing-media-repository";
export async function pickListingImages(remaining: number): Promise<ListingImageAsset[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true, quality: 1 });
  if (result.canceled) return null;
  return result.assets.map(asset => ({ ...avatarAssetFromPicker(asset), width: asset.width, height: asset.height }));
}
export function createNativeListingMediaRepository(origin: string, auth: AuthCoordinator) {
  return createListingMediaRepository(origin, auth, expoFetch, asset => {
    let file: File;
    try { file = new File(asset.uri); if (!file.exists || file.size <= 0) throw new Error(); }
    catch { throw new AuthError("LOCAL_FILE_UNAVAILABLE", "Không đọc được ảnh đã chọn. Hãy chọn lại từ thư viện."); }
    if (file.size > MAX_LISTING_IMAGE_BYTES) throw new AuthError("PAYLOAD_TOO_LARGE", "Mỗi ảnh tối đa 10 MiB.");
    const body = new FormData(); body.append("file", file, asset.name); return body;
  });
}
