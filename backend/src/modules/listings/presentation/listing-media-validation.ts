import sharp from "sharp";
import { HttpException } from "@nestjs/common";
export const MAX_LISTING_MEDIA_BYTES = 10 * 1024 * 1024;
export async function normalizeListingMedia(bytes: Buffer, mime: string) { if (bytes.length > MAX_LISTING_MEDIA_BYTES)
    throw new HttpException("Too large", 413); if (!bytes.length || !["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new HttpException("Unsupported image", 415); try {
    const image = sharp(bytes, { limitInputPixels: 24000000, failOn: "warning", animated: false });
    const meta = await image.metadata();
    if (meta.format !== ({ "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mime]) || (meta.pages ?? 1) > 1 || !meta.width || !meta.height || meta.width > 12000 || meta.height > 12000)
        throw new Error();
    const { data, info } = await image.rotate().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
}
catch {
    throw new HttpException("Invalid image", 415);
} }
