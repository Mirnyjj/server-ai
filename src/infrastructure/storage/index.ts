import { env } from "../../config/env.js";
import type { ObjectStorage } from "./types.js";
import { createS3Storage } from "./s3.storage.js";
import { createLocalStorage } from "./local.storage.js";

export type { ObjectStorage, StorageObject, PutObjectInput } from "./types.js";
export { buildMediaKey, extensionFromMime, guessMimeFromUrl } from "./key.js";
export { resolveLocalStoragePath } from "./local.storage.js";

let singleton: ObjectStorage | null = null;

/**
 * Resolve Object Storage provider.
 *
 * STORAGE_PROVIDER=s3|supabase|r2|minio  → S3 client (needs keys + bucket)
 * STORAGE_PROVIDER=local|unset  → filesystem (dev)
 */
export function getObjectStorage(): ObjectStorage {
  if (singleton) return singleton;

  const provider = (env.STORAGE_PROVIDER ?? "local").toLowerCase();

  if (provider === "s3" || provider === "supabase" || provider === "r2" || provider === "minio") {
    if (
      !env.STORAGE_BUCKET ||
      !env.STORAGE_ACCESS_KEY_ID ||
      !env.STORAGE_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        `STORAGE_PROVIDER=${provider} requires STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY`,
      );
    }
    singleton = createS3Storage();
  } else {
    singleton = createLocalStorage();
  }

  return singleton;
}

export function isObjectStorageConfigured(): boolean {
  const provider = (env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "local") return true;
  return !!(
    env.STORAGE_BUCKET &&
    env.STORAGE_ACCESS_KEY_ID &&
    env.STORAGE_SECRET_ACCESS_KEY
  );
}
