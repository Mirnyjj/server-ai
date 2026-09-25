import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { extname } from "node:path";
import {
  getObjectStorage,
  isObjectStorageConfigured,
  resolveLocalStoragePath,
} from "./index.js";
import { createStorageService } from "./storage.service.js";
import { env } from "../../config/env.js";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

export async function registerStorageRoutes(app: FastifyInstance) {
  app.get("/api/storage/status", async () => {
    const provider = env.STORAGE_PROVIDER ?? "local";
    let name = provider;
    try {
      name = getObjectStorage().name;
    } catch {
      /* not configured */
    }
    return {
      configured: isObjectStorageConfigured(),
      provider,
      name,
      publicBase: env.STORAGE_PUBLIC_BASE_URL ?? null,
      bucket: env.STORAGE_BUCKET ?? null,
    };
  });

  /**
   * Re-host a remote URL into Object Storage + create MediaAsset.
   * Body: { profileId, sourceUrl, mediaType?: IMAGE|VIDEO, kind?: generated|reference|upload }
   */
  app.post("/api/storage/ingest", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      sourceUrl?: string;
      mediaType?: "IMAGE" | "VIDEO";
      kind?: "generated" | "reference" | "upload";
    };

    if (!body.profileId || !body.sourceUrl) {
      return reply.code(400).send({
        error: "profileId and sourceUrl are required",
      });
    }

    try {
      const service = createStorageService();
      const result = await service.ingestUrl({
        profileId: body.profileId,
        sourceUrl: body.sourceUrl,
        mediaType: body.mediaType ?? "IMAGE",
        kind: body.kind ?? "upload",
      });

      return reply.code(201).send({
        success: true,
        asset: result.asset,
        publicUrl: result.object.publicUrl,
        key: result.object.key,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "ingest failed",
      });
    }
  });

  /**
   * Serve local storage files (dev).
   * STORAGE_PUBLIC_BASE_URL=http://host:port/media
   */
  app.get("/media/*", async (request, reply) => {
    const wildcard = (request.params as { "*": string })["*"];
    if (!wildcard) {
      return reply.code(404).send({ error: "not found" });
    }

    const path = resolveLocalStoragePath(wildcard);
    if (!path) {
      return reply.code(404).send({ error: "not found" });
    }

    const ext = extname(path).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";

    return reply
      .type(type)
      .header("Cache-Control", "public, max-age=86400")
      .send(createReadStream(path));
  });
}
