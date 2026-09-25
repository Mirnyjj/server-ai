import { fal } from "@fal-ai/client";
import { env } from "../../../config/env.js";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types.js";

type FalImage = {
  url?: string;
  width?: number;
  height?: number;
  content_type?: string;
};

type FalResult = {
  images?: FalImage[];
};

export function createFalImageGenerator(): ImageGenerator {
  const apiKey = env.IMAGE_MODEL_API_KEY;
  const model = env.IMAGE_MODEL;

  if (!apiKey) {
    throw new Error("IMAGE_MODEL_PROVIDER=fal requires IMAGE_MODEL_API_KEY");
  }

  if (!model) {
    throw new Error("IMAGE_MODEL_PROVIDER=fal requires IMAGE_MODEL");
  }

  fal.config({ credentials: apiKey });

  return {
    name: `fal:${model}`,

    async generate(
      request: ImageGenerationRequest,
    ): Promise<ImageGenerationResult> {
      const input: Record<string, unknown> = {
        prompt: buildPrompt(request),
        num_images: 1,
      };

      if (request.negativePrompt) {
        input.negative_prompt = request.negativePrompt;
      }

      if (request.seed !== undefined) {
        input.seed = request.seed;
      }

      if (request.width && request.height) {
        input.image_size = {
          width: request.width,
          height: request.height,
        };
      } else if (request.aspectRatio) {
        input.aspect_ratio = request.aspectRatio;
      }

      const result = await fal.subscribe(model, { input });
      const data = result.data as FalResult;
      const image = data.images?.[0];

      if (!image?.url) {
        throw new Error(
          `fal image model "${model}" returned no image URL`,
        );
      }

      return {
        url: image.url,
        provider: "fal",
        model,
        width: image.width,
        height: image.height,
        mimeType: image.content_type ?? "image/png",
        raw: result.data,
      };
    },
  };
}

function buildPrompt(request: ImageGenerationRequest): string {
  const references = request.references
    .slice(0, 6)
    .map(
      (reference) =>
        `[${reference.type}] ${reference.description}`,
    )
    .join("; ");

  return [
    request.prompt,
    references ? `Reference descriptions: ${references}` : "",
    request.visualIdentity
      ? `Visual identity: ${JSON.stringify(request.visualIdentity)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
