import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import type {
  ObjectStorage,
  PutFromUrlInput,
  PutObjectInput,
  StorageObject,
} from "./types.js";
import { guessMimeFromUrl } from "./key.js";

/**
 * S3-compatible Object Storage.
 *
 * Supported providers:
 * - AWS S3
 * - Timeweb Cloud S3
 * - Cloudflare R2
 * - MinIO
 *
 * Public URL strategy:
 * 1. STORAGE_PUBLIC_BASE_URL
 *    Explicit public/CDN/custom-domain URL.
 *
 * 2. STORAGE_ENDPOINT
 *    Path-style URL:
 *    https://endpoint/bucket/key
 *
 *    This is required for Timeweb Cloud S3:
 *    https://s3.twcstorage.ru/{bucket}/{key}
 *
 * 3. AWS S3 fallback
 *    https://{bucket}.s3.{region}.amazonaws.com/{key}
 */
export function createS3Storage(): ObjectStorage {
  const bucket = env.STORAGE_BUCKET;

  if (!bucket) {
    throw new Error("STORAGE_BUCKET is required for S3 storage");
  }

  const accessKeyId = env.STORAGE_ACCESS_KEY_ID;

  if (!accessKeyId) {
    throw new Error("STORAGE_ACCESS_KEY_ID is required for S3 storage");
  }

  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;

  if (!secretAccessKey) {
    throw new Error("STORAGE_SECRET_ACCESS_KEY is required for S3 storage");
  }

  const region = env.STORAGE_REGION ?? "auto";

  const endpoint = env.STORAGE_ENDPOINT?.replace(/\/+$/, "");

  const publicBase = env.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, "");

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle:
      env.STORAGE_FORCE_PATH_STYLE === "true" || Boolean(endpoint),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  function getPublicUrl(key: string): string {
    const normalizedKey = key.replace(/^\/+/, "");

    if (!normalizedKey) {
      throw new Error("Storage object key cannot be empty");
    }

    if (publicBase) {
      return `${publicBase}/${normalizedKey}`;
    }

    if (endpoint) {
      return `${endpoint}/${bucket}/${normalizedKey}`;
    }

    return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
  }

  async function putObject(input: PutObjectInput): Promise<StorageObject> {
    const body =
      typeof input.body === "string"
        ? Buffer.from(input.body)
        : Buffer.from(input.body);

    const key = input.key.replace(/^\/+/, "");

    if (!key) {
      throw new Error("Storage object key cannot be empty");
    }

    const result = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: input.contentType,
        CacheControl:
          input.cacheControl ?? "public, max-age=31536000, immutable",
        Metadata: input.metadata,

        ...(env.STORAGE_ACL
          ? {
              ACL: env.STORAGE_ACL as "public-read",
            }
          : {}),
      }),
    );

    return {
      key,
      publicUrl: getPublicUrl(key),
      sizeBytes: body.byteLength,
      contentType: input.contentType,
      etag: result.ETag,
    };
  }

  async function putFromUrl(input: PutFromUrlInput): Promise<StorageObject> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 120_000);

    let response: Response;

    try {
      response = await fetch(input.sourceUrl, {
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Timed out while fetching source ${input.sourceUrl}`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch source ${input.sourceUrl}: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    const contentType =
      input.contentType ||
      response.headers.get("content-type") ||
      guessMimeFromUrl(input.sourceUrl) ||
      "application/octet-stream";

    return putObject({
      key: input.key,
      body: Buffer.from(arrayBuffer),
      contentType,
    });
  }

  async function deleteObject(key: string): Promise<void> {
    const normalizedKey = key.replace(/^\/+/, "");

    if (!normalizedKey) {
      throw new Error("Storage object key cannot be empty");
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: normalizedKey,
      }),
    );
  }

  async function signedUrl(key: string, expiresInSec = 3600): Promise<string> {
    const normalizedKey = key.replace(/^\/+/, "");

    if (!normalizedKey) {
      throw new Error("Storage object key cannot be empty");
    }

    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: normalizedKey,
      }),
      {
        expiresIn: expiresInSec,
      },
    );
  }

  return {
    name: `s3:${bucket}`,
    putObject,
    putFromUrl,
    deleteObject,
    getPublicUrl,
    getSignedUrl: signedUrl,
  };
}
