export type StorageObject = {
  /** Object key inside bucket, e.g. profiles/{id}/gen/{uuid}.jpg */
  key: string;
  /** Public HTTPS URL Meta can fetch */
  publicUrl: string;
  sizeBytes?: number;
  contentType?: string;
  etag?: string;
};

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  /** Cache-Control header */
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export type PutFromUrlInput = {
  key: string;
  sourceUrl: string;
  contentType?: string;
};

export interface ObjectStorage {
  readonly name: string;
  /** Upload bytes → public URL */
  putObject(input: PutObjectInput): Promise<StorageObject>;
  /** Download remote URL and re-host in our bucket (for generator outputs) */
  putFromUrl(input: PutFromUrlInput): Promise<StorageObject>;
  /** Delete by key */
  deleteObject(key: string): Promise<void>;
  /** Public URL for an existing key (no network) */
  getPublicUrl(key: string): string;
  /** Presigned GET URL (private buckets) */
  getSignedUrl?(key: string, expiresInSec?: number): Promise<string>;
}
