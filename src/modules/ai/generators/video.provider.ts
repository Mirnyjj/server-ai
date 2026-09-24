import { env } from "../../../config/env";
import type {
  VideoGenerator,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./types";
import { createHttpVideoGenerator } from "./http.video";

export function createVideoGenerator(): VideoGenerator {
  const provider = (env.VIDEO_GENERATOR_PROVIDER ?? "stub").toLowerCase();
  const model = env.VIDEO_GENERATOR_MODEL ?? "default-video-model";

  if (provider === "http") {
    return createHttpVideoGenerator();
  }

  return {
    name: `stub:${model}`,

    async generate(
      request: VideoGenerationRequest,
    ): Promise<VideoGenerationResult> {
      return {
        url: `https://placeholder.local/generated/${request.profileId}/${Date.now()}.mp4`,
        provider: "stub",
        model,
        durationMs: (request.durationSec ?? 10) * 1000,
        width: 1080,
        height: 1920,
        mimeType: "video/mp4",
        raw: {
          prompt: request.prompt,
          note: "Set VIDEO_GENERATOR_PROVIDER=http + BASE_URL + API_KEY",
        },
      };
    },
  };
}

let singleton: VideoGenerator | null = null;

export function getVideoGenerator(): VideoGenerator {
  if (!singleton) singleton = createVideoGenerator();
  return singleton;
}
