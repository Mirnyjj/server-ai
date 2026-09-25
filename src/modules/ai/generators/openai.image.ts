import { env } from "../../../config/env.js";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types.js";

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
};

export function createOpenAiImageGenerator(): ImageGenerator {
  const apiKey = env.IMAGE_GENERATOR_API_KEY;
  const model = env.IMAGE_GENERATOR_MODEL ?? "gpt-image-2";

  if (!apiKey) {
    throw new Error("IMAGE_GENERATOR_PROVIDER=openai requires IMAGE_GENERATOR_API_KEY");
  }

  return {
    name: "openai:" + model,

    async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const prompt = buildPrompt(request);
      const size = aspectToSize(request.aspectRatio);

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, prompt, n: 1, size }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error("OpenAI image generation failed (" + response.status + "): " + body);
      }

      const json = (await response.json()) as OpenAiImageResponse;
      const item = json.data?.[0];

      if (!item?.b64_json && !item?.url) {
        throw new Error("OpenAI image response did not contain image data");
      }

      const dimensions = parseSize(size);

      return {
        url: item.url,
        contentBase64: item.b64_json,
        provider: "openai",
        model,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: "image/png",
        raw: json,
      };
    },
  };
}

function buildPrompt(request: ImageGenerationRequest): string {
  const references = request.references
    .slice(0, 6)
    .map((reference) => "[" + reference.type + "] " + reference.description)
    .join("; ");

  return [
    request.prompt,
    references ? "Character/style references: " + references : "",
    request.visualIdentity ? "Visual identity: " + JSON.stringify(request.visualIdentity) : "",
    request.negativePrompt ? "Avoid: " + request.negativePrompt : "",
  ].filter(Boolean).join("\n");
}

function aspectToSize(aspectRatio?: ImageGenerationRequest["aspectRatio"]): string {
  switch (aspectRatio) {
    case "1:1": return "1024x1024";
    case "9:16": return "1024x1792";
    case "16:9": return "1792x1024";
    case "4:5":
    default: return "1024x1280";
  }
}

function parseSize(size: string): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}
