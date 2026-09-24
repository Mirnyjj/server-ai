import { env } from "../../../config/env";
import type { ImageGenerator, ImageGenerationRequest, ImageGenerationResult } from "./types";

/**
 * Image generation provider.
 * Configure via IMAGE_GENERATOR_* env. Stub until real provider wired.
 */
export function createImageGenerator(): ImageGenerator {
  const provider = env.IMAGE_GENERATOR_PROVIDER ?? "stub";
  const model = env.IMAGE_GENERATOR_MODEL ?? "default-image-model";

  return {
    name: `${provider}:${model}`,

    async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
      if (provider === "stub" || !env.IMAGE_GENERATOR_API_KEY) {
        // Dev placeholder — real provider returns CDN/S3 URL
        return {
          url: `https://placeholder.local/generated/${request.profileId}/${Date.now()}.jpg`,
          provider: "stub",
          model,
          width: request.width ?? 1080,
          height: request.height ?? 1350,
          mimeType: "image/jpeg",
          raw: {
            prompt: request.prompt,
            referencesCount: request.references.length,
            note: "Set IMAGE_GENERATOR_PROVIDER + API_KEY for real generation",
          },
        };
      }

      // Extension point: fal.ai / Replicate / custom HTTP
      throw new Error(
        `Image generator provider "${provider}" not implemented yet. Use stub or implement adapter.`,
      );
    },
  };
}

let singleton: ImageGenerator | null = null;

export function getImageGenerator(): ImageGenerator {
  if (!singleton) singleton = createImageGenerator();
  return singleton;
}
