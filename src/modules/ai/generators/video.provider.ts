import { env } from "../../../config/env";
import type { VideoGenerator, VideoGenerationRequest, VideoGenerationResult } from "./types";

/**
 * Video generation provider (Reels) — separate model from image & Luna.
 */
export function createVideoGenerator(): VideoGenerator {
  const provider = env.VIDEO_GENERATOR_PROVIDER ?? "stub";
  const model = env.VIDEO_GENERATOR_MODEL ?? "default-video-model";

  return {
    name: `${provider}:${model}`,

    async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
      if (provider === "stub" || !env.VIDEO_GENERATOR_API_KEY) {
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
            referencesCount: request.references.length,
            note: "Set VIDEO_GENERATOR_PROVIDER + API_KEY for real generation",
          },
        };
      }

      throw new Error(
        `Video generator provider "${provider}" not implemented yet. Use stub or implement adapter.`,
      );
    },
  };
}

let singleton: VideoGenerator | null = null;

export function getVideoGenerator(): VideoGenerator {
  if (!singleton) singleton = createVideoGenerator();
  return singleton;
}
