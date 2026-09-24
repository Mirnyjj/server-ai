import { env } from "../../../config/env";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types";
import { createHttpImageGenerator } from "./http.image";

export function createImageGenerator(): ImageGenerator {
  const provider = (env.IMAGE_GENERATOR_PROVIDER ?? "stub").toLowerCase();
  const model = env.IMAGE_GENERATOR_MODEL ?? "default-image-model";

  if (provider === "http") {
    return createHttpImageGenerator();
  }

  // stub (default)
  return {
    name: `stub:${model}`,

    async generate(
      request: ImageGenerationRequest,
    ): Promise<ImageGenerationResult> {
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
          note: "Set IMAGE_GENERATOR_PROVIDER=http + BASE_URL + API_KEY",
        },
      };
    },
  };
}

let singleton: ImageGenerator | null = null;

export function getImageGenerator(): ImageGenerator {
  if (!singleton) singleton = createImageGenerator();
  return singleton;
}
