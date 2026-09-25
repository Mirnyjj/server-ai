import "dotenv/config";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "../prisma/prisma.js";
import { createStorageService } from "../src/infrastructure/storage/storage.service.js";
import {
  getImageGenerator,
  getVideoGenerator,
} from "../src/modules/ai/generators/index.js";
import {
  probeMedia,
  transcodeToMp4,
} from "../src/infrastructure/media/ffmpeg.js";

const profileId = process.env.E2E_PROFILE_ID;
if (!profileId) throw new Error("E2E_PROFILE_ID is required");

const imagePrompt =
  process.env.E2E_IMAGE_PROMPT ??
  "A cinematic vertical lifestyle scene for an Instagram Reel, realistic photography, clean composition, natural light";

const videoPrompt =
  process.env.E2E_VIDEO_PROMPT ??
  "Subtle natural camera movement, realistic motion, stable face and hands, preserve the character identity";

const storage = createStorageService();
const imageGenerator = getImageGenerator();
const videoGenerator = getVideoGenerator();

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

async function downloadVideo(url: string): Promise<Buffer> {
  if (!url.startsWith("https://")) {
    throw new Error("Video generator returned a non-HTTPS URL: " + url);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error("Video download failed: HTTP " + response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("video/")) {
    throw new Error(
      "Video download returned non-video content type: " + contentType,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  console.log("[1/4] Generate image");
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

  console.log("[2/4] Store image and verify public HTTPS");
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

  createdAssets.push({
    id: imageAsset.asset.id,
    storageKey: imageAsset.asset.storageKey,
  });

  await assertPublicHttps(imageAsset.asset.url, "stored image");

  console.log("[3/4] Generate Kling video and transcode with FFmpeg");
  const generatedVideo = await videoGenerator.generate({
    profileId,
    prompt: videoPrompt,
    startImageUrl: imageAsset.asset.url,
    durationSec: 5,
    aspectRatio: "9:16",
    references: [],
  });

  const sourceVideo = await downloadVideo(generatedVideo.url);
  const sourceProbe = await probeMedia(sourceVideo);

  if (!sourceProbe.hasVideo) {
    throw new Error("Kling output does not contain a video stream");
  }

  const finalVideo = await transcodeToMp4(sourceVideo);
  const finalProbe = await probeMedia(finalVideo);

  if (!finalProbe.hasVideo) {
    throw new Error("FFmpeg output does not contain a video stream");
  }

  if (sourceProbe.hasAudio && !finalProbe.hasAudio) {
    throw new Error("FFmpeg output lost the source audio stream");
  }

  console.log(
    "[ok] video: " +
      (sourceProbe.width ?? "?") +
      "x" +
      (sourceProbe.height ?? "?") +
      ", audio=" +
      sourceProbe.hasAudio +
      ", duration=" +
      (sourceProbe.durationSec?.toFixed(2) ?? "?") +
      "s",
  );

  console.log("[4/4] Store final MP4 and verify public HTTPS");
  const videoAsset = await storage.ingestBuffer({
    profileId,
    body: finalVideo,
    contentType: "video/mp4",
    kind: "generated",
    mediaType: "VIDEO",
    metadata: {
      provider: generatedVideo.provider,
      model: generatedVideo.model,
      sourceUrl: generatedVideo.url,
      e2e: true,
      role: "e2e-kling-ffmpeg-video",
      audioPreserved: finalProbe.hasAudio,
    },
  });

  createdAssets.push({
    id: videoAsset.asset.id,
    storageKey: videoAsset.asset.storageKey,
  });

  await assertPublicHttps(videoAsset.asset.url, "stored video");

  console.log("");
  console.log("E2E PASS");
  console.log("image: " + imageAsset.asset.url);
  console.log("video: " + videoAsset.asset.url);
}

try {
  await main();
} finally {
  for (const asset of createdAssets.reverse()) {
    try {
      if (asset.storageKey) await storage.storage.deleteObject(asset.storageKey);
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
    } catch (error) {
      console.error("[cleanup] failed", asset.id, error);
    }
  }

  await prisma.$disconnect();
}
