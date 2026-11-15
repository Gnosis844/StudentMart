import { v2 as cloudinary } from "cloudinary";
import type { AppConfig } from "../../../shared/config/env";
import type { ListingMediaStorage } from "../business/listing-media-storage";
export class CloudinaryListingMediaStorage implements ListingMediaStorage {
    constructor(private readonly config: AppConfig) { }
    private options() { const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = this.config; if (!cloud_name || !api_key || !api_secret)
        throw new Error("Media unavailable"); return { cloud_name, api_key, api_secret, timeout: 15000, secure: true }; }
    async upload(publicId: string, bytes: Buffer): Promise<{
        url: string;
    }> { return new Promise((resolve, reject) => { cloudinary.uploader.upload_stream({ ...this.options(), public_id: publicId, resource_type: "image", overwrite: false, allowed_formats: ["webp"] }, (error, result) => { if (error || !result?.secure_url) {
        reject(new Error("Media unavailable"));
        return;
    } const u = new URL(result.secure_url); if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com") {
        reject(new Error("Invalid media URL"));
        return;
    } resolve({ url: u.href }); }).end(bytes); }); }
    async destroy(publicId: string) { const r = await cloudinary.uploader.destroy(publicId, { ...this.options(), resource_type: "image", invalidate: true }); if (!["ok", "not found"].includes(r.result))
        throw new Error("Media cleanup unavailable"); }
}
