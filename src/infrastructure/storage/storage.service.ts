import { prisma } from "../../../prisma/prisma.js";
import {
  buildMediaKey,
  extensionFromMime,
  getObjectStorage,
  guessMimeFromUrl,
} from "./index.js";

/**
 * High-level storage helpers used by pipeline / references / uploads.
 */
export function createStorageService() {
  const storage = getObjectStorage();

  /** Re-host any URL into our bucket and create MediaAsset */
  async function ingestUrl(input: {
    profileId: string;
    sourceUrl: string;
    kind: "generated" | "reference" | "upload";
    mediaType: "IMAGE" | "VIDEO";
    contentType?: string;
    postId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const mime =
      input.contentType ||
      guessMimeFromUrl(input.sourceUrl) ||
      (input.mediaType === "VIDEO" ? "video/mp4" : "image/jpeg");

    const key = buildMediaKey({
      profileId: input.profileId,
      kind: input.kind,
      ext: extensionFromMime(mime),
      postId: input.postId,
    });

    const object = await storage.putFromUrl({
      key,
      sourceUrl: input.sourceUrl,
      contentType: mime,
    });

    const asset = await prisma.mediaAsset.create({
      data: {
        profileId: input.profileId,
        type: input.mediaType,
        status: "ACTIVE",
        url: object.publicUrl,
        storageKey: object.key,
        mimeType: object.contentType ?? mime,
        sizeBytes: object.sizeBytes ? BigInt(object.sizeBytes) : undefined,
        metadata: {
          ...(input.metadata ?? {}),
          storage: storage.name,
          sourceUrl: input.sourceUrl,
        },
      },
    });

    return { asset, object };
  }

  /** Upload raw buffer */
  async function ingestBuffer(input: {
    profileId: string;
    body: Buffer;
    contentType: string;
    kind: "generated" | "reference" | "upload";
    mediaType: "IMAGE" | "VIDEO";
    postId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const key = buildMediaKey({
      profileId: input.profileId,
      kind: input.kind,
      ext: extensionFromMime(input.contentType),
      postId: input.postId,
    });

    const object = await storage.putObject({
      key,
      body: input.body,
      contentType: input.contentType,
    });

    const asset = await prisma.mediaAsset.create({
      data: {
        profileId: input.profileId,
        type: input.mediaType,
        status: "ACTIVE",
        url: object.publicUrl,
        storageKey: object.key,
        mimeType: input.contentType,
        sizeBytes: object.sizeBytes ? BigInt(object.sizeBytes) : undefined,
        metadata: {
          ...(input.metadata ?? {}),
          storage: storage.name,
        },
      },
    });

    return { asset, object };
  }

  return {
    storage,
    ingestUrl,
    ingestBuffer,
  };
}
