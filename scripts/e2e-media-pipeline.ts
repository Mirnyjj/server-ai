import "dotenv/config";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { prisma } from "../prisma/prisma.js";
import { createStorageService } from "../src/infrastructure/storage/storage.service.js";
import { getImageGenerator, getVideoGenerator } from "../src/modules/ai/generators/index.js";
import { getVideoComposer } from "../src/modules/ai/generators/composer.js";

const profileId = process.env.E2E_PROFILE_ID;
if (!profileId) throw new Error("E2E_PROFILE_ID is required");

const imagePrompt =
  process.env.E2E_IMAGE_PROMPT ??
  "A cinematic vertical lifestyle scene for an Instagram Reel, realistic photography, clean composition, natural light";

const storage = createStorageService();
const imageGenerator = getImageGenerator();
const videoGenerator = getVideoGenerator();
const composer = getVideoComposer();

const createdAssets: Array<{ id: string; storageKey?: string | null }> = [];
const workDir = await mkdtemp(join(tmpdir(), "ig-agent-media-e2e-"));

async function assertPublicHttps(url: string, label: string): Promise<void> {
  if (!url.startsWith("https://")) throw new Error(label + " is not HTTPS: " + url);

  const response = await fetch(url, {
    headers: { Range: "bytes=0-1023" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(label + " is not publicly readable: HTTP " + response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType) throw new Error(label + " has no content-type");

  console.log("[ok] " + label + ": " + response.status + " " + contentType + " " + url);
}

function runCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0]!, args.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(args[0] + " failed (" + code + "): " + stderr.slice(-3000)));
    });
  });
}

async function main(): Promise<void> {
  console.log("[1/4] Generate image");
  const image = await imageGenerator.generate({
    profileId,
    prompt: imagePrompt,
    aspectRatio: "9:16",
    references: [],
  });
  if (!image.contentBase64) throw new Error("Image generator did not return base64 image data");
  console.log("[ok] image: " + image.width + "x" + image.height + ", " + (image.mimeType ?? "unknown"));

  console.log("[2/4] Store image and verify public HTTPS");
  const imageAsset = await storage.ingestBuffer({
    profileId,
    body: Buffer.from(image.contentBase64, "base64"),
    contentType: image.mimeType ?? "image/png",
    kind: "generated",
    mediaType: "IMAGE",
    metadata: { provider: image.provider, model: image.model, e2e: true, role: "e2e-reel-frame" },
  });
  createdAssets.push({ id: imageAsset.asset.id, storageKey: imageAsset.asset.storageKey });
  await assertPublicHttps(imageAsset.asset.url, "stored image");

  console.log("[3/4] Kling image-to-video → Storage → public HTTPS");
  const video = await videoGenerator.generate({
    profileId,
    prompt: imagePrompt,
    startImageUrl: imageAsset.asset.url,
    aspectRatio: "9:16",
    durationSec: 5,
    references: [],
  });
  if (!video.url) throw new Error("Video generator did not return a URL");

  const sceneAsset = await storage.ingestUrl({
    profileId,
    sourceUrl: video.url,
    mediaType: "VIDEO",
    kind: "generated",
    contentType: video.mimeType ?? "video/mp4",
    metadata: { provider: video.provider, model: video.model, e2e: true, role: "e2e-reel-scene" },
  });
  createdAssets.push({ id: sceneAsset.asset.id, storageKey: sceneAsset.asset.storageKey });
  await assertPublicHttps(sceneAsset.asset.url, "stored Kling scene");

  console.log("[4/4] FFmpeg compose → final Reel → Storage → public HTTPS");
  const composed = await composer.compose({
    scenes: [{ url: sceneAsset.asset.url, durationSec: 5 }],
    width: 720,
    height: 1280,
    fps: 30,
    outputFormat: "mp4",
  });

  const finalPath = join(workDir, "final-reel.mp4");
  await writeFile(finalPath, Buffer.from(composed.contentBase64, "base64"));

  const videoStreams = await runCommand([
    "ffprobe", "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height", "-of", "json", finalPath,
  ]);
  const audioStreams = await runCommand([
    "ffprobe", "-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=codec_name", "-of", "json", finalPath,
  ]);

  if (!videoStreams.includes('"codec_name"')) throw new Error("Final Reel has no video stream");
  if (!audioStreams.includes('"codec_name"')) throw new Error("Final Reel has no audio stream");

  const finalAsset = await storage.ingestBuffer({
    profileId,
    body: Buffer.from(composed.contentBase64, "base64"),
    contentType: composed.mimeType,
    kind: "generated",
    mediaType: "VIDEO",
    metadata: { provider: "ffmpeg", model: "ffmpeg", e2e: true, role: "e2e-reel-final", sceneCount: 1 },
  });
  createdAssets.push({ id: finalAsset.asset.id, storageKey: finalAsset.asset.storageKey });
  await assertPublicHttps(finalAsset.asset.url, "final Reel");

  console.log("");
  console.log("E2E PASS");
  console.log("final Reel: " + finalAsset.asset.url);
  console.log("durationMs: " + composed.durationMs);
  console.log("audio: present");
  console.log("video: present");
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
  await rm(workDir, { recursive: true, force: true });
}
