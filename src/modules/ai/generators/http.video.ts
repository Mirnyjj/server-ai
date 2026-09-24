import { env } from "../../../config/env";
import type {
  VideoGenerator,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./types";

/**
 * Generic HTTP video generator.
 * POST body: { model, prompt, duration, aspect_ratio, image_url? }
 * Response: { url } | { video_url } | { data: [{ url }] } | { output: [url] }
 */
export function createHttpVideoGenerator(): VideoGenerator {
  const model = env.VIDEO_GENERATOR_MODEL ?? "default";
  const baseUrl = env.VIDEO_GENERATOR_BASE_URL;
  const apiKey = env.VIDEO_GENERATOR_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "VIDEO_GENERATOR_PROVIDER=http requires VIDEO_GENERATOR_BASE_URL and VIDEO_GENERATOR_API_KEY",
    );
  }

  return {
    name: `http:${model}`,

    async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
      const refBlock = request.references
        .slice(0, 4)
        .map((r) => `[${r.type}] ${r.description}`)
        .join("; ");

      const prompt = [request.prompt, refBlock ? `Character: ${refBlock}` : ""]
        .filter(Boolean)
        .join("\n");

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          duration: request.durationSec ?? 5,
          aspect_ratio: request.aspectRatio ?? "9:16",
          image_url: request.startImageUrl,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Video generator HTTP ${response.status}: ${text}`);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const url = extractVideoUrl(json);

      if (!url) {
        throw new Error(
          `Video generator response missing url: ${JSON.stringify(json).slice(0, 300)}`,
        );
      }

      return {
        url,
        provider: "http",
        model,
        mimeType: "video/mp4",
        durationMs: (request.durationSec ?? 5) * 1000,
        raw: json,
      };
    },
  };
}

function extractVideoUrl(json: Record<string, unknown>): string | null {
  if (typeof json.url === "string") return json.url;
  if (typeof json.video_url === "string") return json.video_url;

  const data = json.data;
  if (Array.isArray(data) && data[0]) {
    const first = data[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }

  const output = json.output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];

  return null;
}
