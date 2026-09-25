export type S3PublicUrlInput = {
  key: string;
  bucket: string;
  endpoint?: string;
  publicBase?: string;
  region: string;
};

/**
 * Build the public URL for an S3-compatible object.
 *
 * STORAGE_PUBLIC_BASE_URL normally points to a public object root/CDN.
 * When it is exactly the same URL as STORAGE_ENDPOINT, it is only the
 * S3 API endpoint, so the bucket must be inserted for path-style URLs.
 */
export function buildS3PublicUrl(input: S3PublicUrlInput): string {
  const key = input.key.replace(/^\/+/, "");
  const bucket = input.bucket.trim();

  if (!key) {
    throw new Error("Storage object key cannot be empty");
  }

  if (!bucket) {
    throw new Error("Storage bucket cannot be empty");
  }

  const endpoint = input.endpoint?.replace(/\/+$/, "");
  const publicBase = input.publicBase?.replace(/\/+$/, "");

  if (publicBase) {
    if (endpoint && publicBase === endpoint) {
      return `${endpoint}/${bucket}/${key}`;
    }

    return `${publicBase}/${key}`;
  }

  if (endpoint) {
    return `${endpoint}/${bucket}/${key}`;
  }

  return `https://${bucket}.s3.${input.region}.amazonaws.com/${key}`;
}
