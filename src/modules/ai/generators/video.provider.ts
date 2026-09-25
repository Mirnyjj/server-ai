import { env } from "../../../config/env.js";
import type {
  VideoGenerator,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./types.js";
import { createHttpVideoGenerator } from "./http.video.js";
import { createFalVideoGenerator } from "./fal.video.js";
import { createOpenAiVideoGenerator } from "./openai.video.js";

export function createVideoGenerator(): VideoGenerator {
  const provider = (env.VIDEO_GENERATOR_PROVIDER ?? "fal").toLowerCase();
  const model = env.VIDEO_GENERATOR_MODEL ?? "fal-ai/kling-video/v3/pro/image-to-video";

  if (provider === "fal") return createFalVideoGenerator();
  if (provider === "openai") return createOpenAiVideoGenerator();
  if (provider === "http") return createHttpVideoGenerator();

  return {
    name: "stub:" + model,
    async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
      return {
        url: "https://placeholder.local/generated/" + request.profileId + "/" + Date.now() + ".mp4",
        provider: "stub",
        model,
        durationMs: (request.durationSec ?? 10) * 1000,
        width: 1080,
        height: 1920,
        mimeType: "video/mp4",
        raw: { prompt: request.prompt },
      };
    },
  };
}

let singleton: VideoGenerator | null = null;

export function getVideoGenerator(): VideoGenerator {
  if (!singleton) singleton = createVideoGenerator();
  return singleton;
}
