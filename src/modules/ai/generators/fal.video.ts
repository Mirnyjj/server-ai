import { fal } from "@fal-ai/client";
import { env } from "../../../config/env.js";
import type {
  VideoGenerator,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./types.js";

type FalVideoResult = {
  video?: {
    url?: string;
    content_type?: string;
  };
};

export function createFalVideoGenerator(): VideoGenerator {
  const credentials = env.VIDEO_GENERATOR_API_KEY;
  const model =
    env.VIDEO_GENERATOR_MODEL ?? "fal-ai/kling-video/v3/pro/image-to-video";

  if (!credentials) {
    throw new Error(
      "VIDEO_GENERATOR_PROVIDER=fal requires VIDEO_GENERATOR_API_KEY",
    );
  }

  fal.config({ credentials });

  return {
    name: "fal:" + model,

    async generate(
      request: VideoGenerationRequest,
    ): Promise<VideoGenerationResult> {
      if (!request.startImageUrl) {
        throw new Error("Fal Kling image-to-video requires startImageUrl");
      }

      const result = await fal.subscribe(model, {
        input: {
          start_image_url: request.startImageUrl,
          prompt: request.prompt,
          duration: normalizeDuration(request.durationSec),
          generate_audio: true,
          negative_prompt:
            "blur, distort, low quality, unstable face, extra fingers",
        },
      });

      const data = result.data as FalVideoResult;
      const url = data.video?.url;

      if (!url) {
        throw new Error("Fal video response did not contain video.url");
      }

      const seconds = normalizeDuration(request.durationSec);

      return {
        url,
        provider: "fal",
        model,
        durationMs: seconds * 1000,
        mimeType: data.video?.content_type ?? "video/mp4",
        raw: result.data,
      };
    },
  };
}

function normalizeDuration(
  value?: number,
): 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 {
  const rounded = Math.round(value ?? 5);
  return Math.max(3, Math.min(15, rounded)) as
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15;
}
