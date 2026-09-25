import { env } from "../../../config/env.js";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types.js";

type ImagesApiResult = {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string; code?: string };
};

/**
 * Timeweb AI Gateway Images API adapter.
 *
 * Uses POST /images/generations with the configured image model.
 * The provider may return either a public image URL or base64 JSON data;
 * this adapter normalizes both forms to ImageGenerationResult.contentBase64.
 */
export function createHttpImageGenerator(): ImageGenerator {
  const imageModel = env.IMAGE_MODEL ?? "black_forest_labs/flux-2-pro";
  const baseUrl = env.IMAGE_MODEL_BASE_URL;
  const apiKey = env.IMAGE_MODEL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Image model requires IMAGE_MODEL_BASE_URL and IMAGE_MODEL_API_KEY");
  }

  const endpoint = new URL(
    "images/generations",
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();

  return {
    name: `images:${imageModel}`,

    async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(120_000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: buildPrompt(request),
        }),
      });

      const json = (await response.json()) as ImagesApiResult;

      if (!response.ok) {
        const providerMessage = json.error?.message ?? JSON.stringify(json).slice(0, 500);
        throw new Error(`Image generator HTTP ${response.status}: ${providerMessage}`);
      }

      const image = json.data?.[0];
      if (!image) {
        throw new Error(`Image generator response did not contain an image: ${JSON.stringify(json).slice(0, 500)}`);
      }

      const normalized = await normalizeImageResponse(image);
      const size = aspectToSize(request.aspectRatio);

      return {
        contentBase64: normalized.contentBase64,
        provider: "timeweb",
        model: imageModel,
        mimeType: normalized.mimeType,
        width: normalized.width ?? size.width,
        height: normalized.height ?? size.height,
        raw: json,
      };
    },
  };
}

async function normalizeImageResponse(image: { url?: string; b64_json?: string }): Promise<{
  contentBase64: string;
  mimeType: string;
  width?: number;
  height?: number;
}> {
  if (image.b64_json) {
    const buffer = Buffer.from(image.b64_json, "base64");
    const metadata = detectImageMetadata(buffer);
    return {
      contentBase64: image.b64_json,
      mimeType: metadata?.mimeType ?? "image/png",
      width: metadata?.width,
      height: metadata?.height,
    };
  }

  if (!image.url) throw new Error("Image generator response did not contain url or b64_json");
  if (!image.url.startsWith("https://")) throw new Error("Image generator returned a non-HTTPS image URL");

  const response = await fetch(image.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Image generator image URL HTTP ${response.status}: ${image.url}`);

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Image generator image URL returned non-image content type: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = detectImageMetadata(buffer);
  return {
    contentBase64: buffer.toString("base64"),
    mimeType: metadata?.mimeType ?? contentType,
    width: metadata?.width,
    height: metadata?.height,
  };
}

function buildPrompt(request: ImageGenerationRequest): string {
  const parts = [request.prompt, `Required composition: ${request.aspectRatio ?? "4:5"} aspect ratio.`];
  if (request.negativePrompt) parts.push(`Avoid: ${request.negativePrompt}`);
  if (request.visualIdentity) parts.push(`Visual identity: ${JSON.stringify(request.visualIdentity)}`);

  const referenceDescriptions = request.references
    .slice(0, 6)
    .filter((reference) => reference.url.startsWith("https://"))
    .map((reference) => `[${reference.type}] ${reference.description}`)
    .filter(Boolean);

  if (referenceDescriptions.length > 0) {
    parts.push(`Reference images are available to the pipeline. Preserve relevant character/visual consistency. Reference notes: ${referenceDescriptions.join("; ")}`);
  }
  return parts.join("\n\n");
}

type ImageSize = { width: number; height: number };

function aspectToSize(aspect?: string): ImageSize {
  switch (aspect) {
    case "9:16": return { width: 1024, height: 1536 };
    case "16:9": return { width: 1536, height: 1024 };
    case "1:1": return { width: 1024, height: 1024 };
    case "4:5":
    default: return { width: 1024, height: 1280 };
  }
}

function detectImageMetadata(buffer: Buffer): { mimeType: string; width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mimeType: "image/png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && (buffer.subarray(0, 6).toString() === "GIF89a" || buffer.subarray(0, 6).toString() === "GIF87a")) {
    return { mimeType: "image/gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" && buffer.subarray(12, 16).toString() === "VP8X") {
    return {
      mimeType: "image/webp",
      width: 1 + buffer[24]! + (buffer[25]! << 8) + (buffer[26]! << 16),
      height: 1 + buffer[27]! + (buffer[28]! << 8) + (buffer[29]! << 16),
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpeg = detectJpegSize(buffer);
    if (jpeg) return { mimeType: "image/jpeg", ...jpeg };
  }
  return null;
}

function detectJpegSize(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0xda || marker === 0xd0 || marker === 0xd1) continue;
    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && offset + 7 <= buffer.length) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}