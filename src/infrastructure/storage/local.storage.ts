import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { writeFile } from "node:fs/promises";
import { env } from "../../config/env";
import type {
  ObjectStorage,
  PutFromUrlInput,
  PutObjectInput,
  StorageObject,
} from "./types";
import { guessMimeFromUrl } from "./key";

/**
 * Local filesystem storage for development.
 * Files under STORAGE_LOCAL_PATH, served via GET /media/* if public base points at API.
 *
 * Meta Graph API needs a real public HTTPS URL — local paths only work behind a tunnel
 * (ngrok/cloudflared) with STORAGE_PUBLIC_BASE_URL set to that tunnel.
 */
export function createLocalStorage(): ObjectStorage {
  const root = env.STORAGE_LOCAL_PATH ?? "./storage-data";
  const publicBase = (
    env.STORAGE_PUBLIC_BASE_URL ??
    `http://127.0.0.1:${env.API_PORT}/media`
  ).replace(/\/$/, "");

  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }

  function absPath(key: string): string {
    // prevent path traversal
    const safe = key.replace(/\\/g, "/").replace(/\.\./g, "");
    return join(root, safe);
  }

  function getPublicUrl(key: string): string {
    return `${publicBase}/${key}`;
  }

  async function putObject(input: PutObjectInput): Promise<StorageObject> {
    const path = absPath(input.key);
    mkdirSync(dirname(path), { recursive: true });

    const body =
      typeof input.body === "string"
        ? Buffer.from(input.body)
        : Buffer.from(input.body);

    await writeFile(path, body);

    return {
      key: input.key,
      publicUrl: getPublicUrl(input.key),
      sizeBytes: body.byteLength,
      contentType: input.contentType,
    };
  }

  async function putFromUrl(input: PutFromUrlInput): Promise<StorageObject> {
    const response = await fetch(input.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${input.sourceUrl}: ${response.status}`);
    }

    const contentType =
      input.contentType ||
      response.headers.get("content-type") ||
      guessMimeFromUrl(input.sourceUrl) ||
      "application/octet-stream";

    const path = absPath(input.key);
    mkdirSync(dirname(path), { recursive: true });

    if (response.body) {
      // Node fetch body as web stream → file
      const buf = Buffer.from(await response.arrayBuffer());
      await writeFile(path, buf);
      return {
        key: input.key,
        publicUrl: getPublicUrl(input.key),
        sizeBytes: buf.byteLength,
        contentType,
      };
    }

    throw new Error("Empty response body");
  }

  async function deleteObject(key: string): Promise<void> {
    const path = absPath(key);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  return {
    name: `local:${root}`,
    putObject,
    putFromUrl,
    deleteObject,
    getPublicUrl,
  };
}

/** Resolve absolute path for static file serving */
export function resolveLocalStoragePath(key: string): string | null {
  const root = env.STORAGE_LOCAL_PATH ?? "./storage-data";
  const safe = key.replace(/\\/g, "/").replace(/\.\./g, "");
  const path = join(root, safe);
  if (!existsSync(path)) return null;
  return path;
}
