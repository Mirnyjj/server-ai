import "dotenv/config";

import { rm } from "node:fs/promises";
import { prisma } from "../prisma/prisma.js";
import { createStorageService } from "../src/infrastructure/storage/storage.service.js";
import { getImageGenerator } from "../src/modules/ai/generators/index.js";

const profileId = process.env.E2E_PROFILE_ID;
if (!profileId) throw new Error("E2E_PROFILE_ID is required");

const imagePrompt =
  process.env.E2E_IMAGE_PROMPT ??
  "A cinematic vertical lifestyle scene for an Instagram Reel, realistic photography, clean composition, natural light";

const storage = createStorageService();
const imageGenerator = getImageGenerator();

const createdAssets: Array<{ id: string; storageKey?: string | null }> = [];

async function assertPublicHttps(url: string, label: string): Promise<void> {
  if (!url.startsWith("https://"))
    throw new Error(label + " is not HTTPS: " + url);

  const response = await fetch(url, {
    headers: { Range: "bytes=0-1023" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(
      label + " is not publicly readable: HTTP " + response.status,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType) throw new Error(label + " has no content-type");

  console.log(
    "[ok] " + label + ": " + response.status + " " + contentType + " " + url,
  );
}

async function main(): Promise<void> {
  console.log("[1/2] Generate image");
  const image = await imageGenerator.generate({
    profileId,
    prompt: imagePrompt,
    aspectRatio: "9:16",
    references: [],
  });

  if (!image.contentBase64)
    throw new Error("Image generator did not return base64 image data");

  console.log(
    "[ok] image: " +
      image.width +
      "x" +
      image.height +
      ", " +
      (image.mimeType ?? "unknown"),
  );

  console.log("[2/2] Store image and verify public HTTPS");
  const imageAsset = await storage.ingestBuffer({
    profileId,
    body: Buffer.from(image.contentBase64, "base64"),
    contentType: image.mimeType ?? "image/png",
    kind: "generated",
    mediaType: "IMAGE",
    metadata: {
      provider: image.provider,
      model: image.model,
      e2e: true,
      role: "e2e-image",
    },
  });

  console.log("[storage] image key:", imageAsset.asset.storageKey);
  console.log("[storage] image url:", imageAsset.asset.url);

  createdAssets.push({
    id: imageAsset.asset.id,
    storageKey: imageAsset.asset.storageKey,
  });

  await assertPublicHttps(imageAsset.asset.url, "stored image");

  console.log("");
  console.log("E2E PASS");
  console.log("image: " + imageAsset.asset.url);
}

try {
  await main();
} finally {
  for (const asset of createdAssets.reverse()) {
    try {
      if (asset.storageKey)
        await storage.storage.deleteObject(asset.storageKey);
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
    } catch (error) {
      console.error("[cleanup] failed", asset.id, error);
    }
  }

  await prisma.$disconnect();
}
