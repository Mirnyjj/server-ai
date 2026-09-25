import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

import { env } from "../../config/env.js";
import type {
  ObjectStorage,
  PutFromUrlInput,
  PutObjectInput,
  StorageObject,
} from "./types.js";
import { guessMimeFromUrl } from "./key.js";

/**
 * Local filesystem storage for development.
 *
 * Files are stored under STORAGE_LOCAL_PATH and should be exposed
 * through GET /media/*.
 *
 * Meta Graph API requires a real public HTTPS URL.
 * For local development use a tunnel, for example:
 *
 * STORAGE_PUBLIC_BASE_URL=https://example.ngrok.app/media
 */
export function createLocalStorage(): ObjectStorage {
  const root = env.STORAGE_LOCAL_PATH ?? "./storage-data.js";

  const publicBase = (
    env.STORAGE_PUBLIC_BASE_URL ?? `http://127.0.0.1:${env.API_PORT}/media`
  ).replace(/\/+$/, "");

  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }

  function normalizeKey(key: string): string {
    const normalized = key
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .filter((part) => part !== "" && part !== "." && part !== "..")
      .join("/");

    if (!normalized) {
      throw new Error("Storage object key cannot be empty");
    }

    return normalized;
  }

  function absPath(key: string): string {
    return join(root, normalizeKey(key));
  }

  function getPublicUrl(key: string): string {
    return `${publicBase}/${normalizeKey(key)}`;
  }

  async function putObject(input: PutObjectInput): Promise<StorageObject> {
    const key = normalizeKey(input.key);
    const path = absPath(key);

    mkdirSync(dirname(path), { recursive: true });

    const body =
      typeof input.body === "string"
        ? Buffer.from(input.body)
        : Buffer.from(input.body);

    await writeFile(path, body);

    return {
      key,
      publicUrl: getPublicUrl(key),
      sizeBytes: body.byteLength,
      contentType: input.contentType,
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

    const contentType =
      input.contentType ||
      response.headers.get("content-type") ||
      guessMimeFromUrl(input.sourceUrl) ||
      "application/octet-stream";

    const body = Buffer.from(await response.arrayBuffer());

    if (body.byteLength === 0) {
      throw new Error(`Empty response body from ${input.sourceUrl}`);
    }

    const key = normalizeKey(input.key);
    const path = absPath(key);

    mkdirSync(dirname(path), { recursive: true });
    await writeFile(path, body);

    return {
      key,
      publicUrl: getPublicUrl(key),
      sizeBytes: body.byteLength,
      contentType,
    };
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

/**
 * Resolve an existing local storage object to an absolute filesystem path.
 *
 * Returns null when the object does not exist.
 */
export function resolveLocalStoragePath(key: string): string | null {
  const root = env.STORAGE_LOCAL_PATH ?? "./storage-data";

  const normalizedKey = key
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part !== "" && part !== "." && part !== "..")
    .join("/");

  if (!normalizedKey) {
    return null;
  }

  const path = join(root, normalizedKey);

  if (!existsSync(path)) {
    return null;
  }

  return path;
}
