import { env } from "../../../config/env.js";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types.js";
import { createHttpImageGenerator } from "./http.image.js";
import { createOpenAiImageGenerator } from "./openai.image.js";
import { createFalImageGenerator } from "./fal.image.js";

export function createImageGenerator(): ImageGenerator {
  const provider = (env.IMAGE_MODEL_PROVIDER ?? "fal").toLowerCase();
  const model = env.IMAGE_MODEL ?? "fal-ai/gpt-image-1/text-to-image";

  if (provider === "fal") return createFalImageGenerator();
  if (provider === "openai") return createOpenAiImageGenerator();
  if (provider === "http") return createHttpImageGenerator();

  return {
    name: "stub:" + model,
    async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
      return {
        url: "https://placeholder.local/generated/" + request.profileId + "/" + Date.now() + ".jpg",
        provider: "stub",
        model,
        width: request.width ?? 1080,
        height: request.height ?? 1350,
        mimeType: "image/jpeg",
        raw: { prompt: request.prompt, referencesCount: request.references.length },
      };
    },
  };
}

let singleton: ImageGenerator | null = null;

export function getImageGenerator(): ImageGenerator {
  if (!singleton) singleton = createImageGenerator();
  return singleton;
}
