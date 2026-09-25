import { env } from "../../../config/env.js";
import type {
  VideoGenerator,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./types.js";

type VideoJob = {
  id: string;
  model: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "expired";
  progress?: number;
  seconds?: string;
  size?: string;
  error?: { code?: string; message?: string } | null;
};

export function createOpenAiVideoGenerator(): VideoGenerator {
  const apiKey = env.VIDEO_GENERATOR_API_KEY;
  const model = env.VIDEO_GENERATOR_MODEL ?? "sora-2";

  if (!apiKey) {
    throw new Error("VIDEO_GENERATOR_PROVIDER=openai requires VIDEO_GENERATOR_API_KEY");
  }

  return {
    name: "openai:" + model,

    async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
      const seconds = normalizeSeconds(request.durationSec);
      const size = aspectToSize(request.aspectRatio);

      const createResponse = await fetch("https://api.openai.com/v1/videos", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: buildPrompt(request),
          seconds: String(seconds),
          size,
          ...(request.startImageUrl
            ? { input_reference: { image_url: request.startImageUrl } }
            : {}),
        }),
      });

      if (!createResponse.ok) {
        const body = await createResponse.text();
        throw new Error("OpenAI video creation failed (" + createResponse.status + "): " + body);
      }

      let job = (await createResponse.json()) as VideoJob;

      while (job.status === "queued" || job.status === "in_progress") {
        await sleep(env.VIDEO_GENERATOR_POLL_MS ?? 5000);

        const statusResponse = await fetch(
          "https://api.openai.com/v1/videos/" + encodeURIComponent(job.id),
          { headers: { Authorization: "Bearer " + apiKey } },
        );

        if (!statusResponse.ok) {
          const body = await statusResponse.text();
          throw new Error("OpenAI video status failed (" + statusResponse.status + "): " + body);
        }

        job = (await statusResponse.json()) as VideoJob;
      }

      if (job.status !== "completed") {
        throw new Error(
          "OpenAI video generation failed: " + (job.error?.message ?? job.status),
        );
      }

      const contentResponse = await fetch(
        "https://api.openai.com/v1/videos/" + encodeURIComponent(job.id) + "/content",
        { headers: { Authorization: "Bearer " + apiKey } },
      );

      if (!contentResponse.ok) {
        const body = await contentResponse.text();
        throw new Error("OpenAI video download failed (" + contentResponse.status + "): " + body);
      }

      const buffer = Buffer.from(await contentResponse.arrayBuffer());
      const dimensions = parseSize(job.size ?? size);

      return {
        contentBase64: buffer.toString("base64"),
        provider: "openai",
        model,
        durationMs: Number(job.seconds ?? seconds) * 1000,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: "video/mp4",
        raw: job,
      };
    },
  };
}

function buildPrompt(request: VideoGenerationRequest): string {
  const references = request.references
    .slice(0, 4)
    .map((reference) => "[" + reference.type + "] " + reference.description)
    .join("; ");

  return [
    request.prompt,
    references ? "Character/style references: " + references : "",
    request.visualIdentity ? "Visual identity: " + JSON.stringify(request.visualIdentity) : "",
  ].filter(Boolean).join("\n");
}

function normalizeSeconds(value?: number): 4 | 8 | 12 {
  if (!value) return 8;
  if (value <= 4) return 4;
  if (value <= 8) return 8;
  return 12;
}

function aspectToSize(aspectRatio?: VideoGenerationRequest["aspectRatio"]): string {
  switch (aspectRatio) {
    case "16:9": return "1280x720";
    case "1:1": return "720x720";
    case "9:16":
    default: return "720x1280";
  }
}

function parseSize(size: string): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
