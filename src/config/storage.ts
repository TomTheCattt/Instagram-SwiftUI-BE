import { S3Client } from "@aws-sdk/client-s3";

export const STORAGE_ENDPOINT =
  process.env.S3_ENDPOINT ||
  process.env.NEON_STORAGE_ENDPOINT ||
  "http://localhost:9000";

export const STORAGE_ACCESS_KEY_ID =
  process.env.S3_ACCESS_KEY_ID ||
  process.env.NEON_STORAGE_ACCESS_KEY_ID ||
  "";

export const STORAGE_SECRET_ACCESS_KEY =
  process.env.S3_SECRET_ACCESS_KEY ||
  process.env.NEON_STORAGE_SECRET_ACCESS_KEY ||
  "";

export const STORAGE_REGION =
  process.env.S3_REGION ||
  "auto";

export const CDN_BASE_URL =
  process.env.CDN_BASE_URL ||
  STORAGE_ENDPOINT;

export const UPLOAD_BUCKET = process.env.S3_UPLOAD_BUCKET || "uploads";
export const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET || "media";
export const THUMBNAIL_BUCKET = process.env.S3_THUMBNAIL_BUCKET || "thumbnails";

/**
 * Shared S3 Client configured for S3-compatible object storage
 * (Cloudflare R2, MinIO, AWS S3, or Supabase Storage)
 */
export const s3Client = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY_ID,
    secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/**
 * Construct public/storage URL for an object
 */
export function getStorageUrl(bucket: string, storagePath: string): string {
  const base = STORAGE_ENDPOINT.replace(/\/$/, "");
  const cleanPath = storagePath.replace(/^\//, "");
  return `${base}/${bucket}/${cleanPath}`;
}

/**
 * Rewrite a storage URL to use the CDN base URL if configured
 */
export function rewriteToCdnUrl(originalUrl: string): string {
  if (!CDN_BASE_URL || CDN_BASE_URL === STORAGE_ENDPOINT) {
    return originalUrl;
  }
  const endpoint = STORAGE_ENDPOINT.replace(/\/$/, "");
  const cdn = CDN_BASE_URL.replace(/\/$/, "");
  if (originalUrl.startsWith(endpoint)) {
    return originalUrl.replace(endpoint, cdn);
  }
  return originalUrl;
}
