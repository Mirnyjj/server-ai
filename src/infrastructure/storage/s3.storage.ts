import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
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
 * S3-compatible Object Storage (AWS S3, Cloudflare R2, MinIO).
 *
 * Public URL strategy:
 * 1. STORAGE_PUBLIC_BASE_URL if set (CDN / R2 custom domain / public bucket URL)
 * 2. else virtual-hosted style https://{bucket}.s3.{region}.amazonaws.com/{key}
 * 3. R2: set STORAGE_PUBLIC_BASE_URL to https://pub-xxx.r2.dev or custom domain
 */
export function createS3Storage(): ObjectStorage {
  const bucket = env.STORAGE_BUCKET!;
  const region = env.STORAGE_REGION ?? "auto";
  const publicBase = env.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, "");

  const client = new S3Client({
    region,
    endpoint: env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
    },
  });

  function getPublicUrl(key: string): string {
    if (publicBase) {
      return `${publicBase}/${key}`;
    }
    if (env.STORAGE_ENDPOINT) {
      // path-style: endpoint/bucket/key
      const ep = env.STORAGE_ENDPOINT.replace(/\/$/, "");
      return `${ep}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async function putObject(input: PutObjectInput): Promise<StorageObject> {
    const body =
      typeof input.body === "string"
        ? Buffer.from(input.body)
        : Buffer.from(input.body);

    const result = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
        Metadata: input.metadata,
        // ACL only if bucket allows ACLs (many R2/S3 buckets use bucket policy instead)
        ...(env.STORAGE_ACL ? { ACL: env.STORAGE_ACL as "public-read" } : {}),
      }),
    );

    return {
      key: input.key,
      publicUrl: getPublicUrl(input.key),
      sizeBytes: body.byteLength,
      contentType: input.contentType,
      etag: result.ETag,
    };
  }

  async function putFromUrl(input: PutFromUrlInput): Promise<StorageObject> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const response = await fetch(input.sourceUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch source ${input.sourceUrl}: ${response.status}`,
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
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async function signedUrl(key: string, expiresInSec = 3600): Promise<string> {
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSec },
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
