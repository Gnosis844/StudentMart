export const LISTING_MEDIA_STORAGE = Symbol("LISTING_MEDIA_STORAGE");
export interface ListingMediaStorage {
    upload(publicId: string, bytes: Buffer): Promise<{
        url: string;
    }>;
    destroy(publicId: string): Promise<void>;
}
