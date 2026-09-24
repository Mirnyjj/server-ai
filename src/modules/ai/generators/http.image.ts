import { env } from "../../../config/env";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types";

/**
 * Generic HTTP image generator.
 *
 * Expects OpenAI-compatible images API OR custom JSON:
 * POST { baseUrl }
 * Authorization: Bearer KEY
 * Body: { model, prompt, size?, n: 1, response_format: "url" }
 * Response: { data: [{ url }] }  OR  { url }  OR  { image_url }
 *
 * Reference URLs appended to prompt text (most APIs don't support multi-ref natively).
 */
export function createHttpImageGenerator(): ImageGenerator {
  const model = env.IMAGE_GENERATOR_MODEL ?? "default";
  const baseUrl = env.IMAGE_GENERATOR_BASE_URL;
  const apiKey = env.IMAGE_GENERATOR_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "IMAGE_GENERATOR_PROVIDER=http requires IMAGE_GENERATOR_BASE_URL and IMAGE_GENERATOR_API_KEY",
    );
  }

  return {
    name: `http:${model}`,

    async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const refBlock = request.references
        .slice(0, 6)
        .map((r) => `[${r.type}] ${r.description}`)
        .join("; ");

      const prompt = [
        request.prompt,
        refBlock ? `Character consistency: ${refBlock}` : "",
        request.negativePrompt ? `Avoid: ${request.negativePrompt}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const size =
        request.width && request.height
          ? `${request.width}x${request.height}`
          : aspectToSize(request.aspectRatio);

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          response_format: "url",
          // optional fields some providers accept
          reference_images: request.references.map((r) => r.url),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Image generator HTTP ${response.status}: ${text}`);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const url = extractImageUrl(json);

      if (!url) {
        throw new Error(
          `Image generator response missing url: ${JSON.stringify(json).slice(0, 300)}`,
        );
      }

      return {
        url,
        provider: "http",
        model,
        mimeType: "image/jpeg",
        width: request.width,
        height: request.height,
        raw: json,
      };
    },
  };
}

function extractImageUrl(json: Record<string, unknown>): string | null {
  if (typeof json.url === "string") return json.url;
  if (typeof json.image_url === "string") return json.image_url;

  const data = json.data;
  if (Array.isArray(data) && data[0]) {
    const first = data[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
    if (typeof first.b64_json === "string") {
      // data URL — storage can still ingest via putObject if we convert later
      return `data:image/png;base64,${first.b64_json}`;
    }
  }

  const output = json.output;
  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0];
  }

  return null;
}

function aspectToSize(aspect?: string): string {
  switch (aspect) {
    case "9:16":
      return "1024x1792";
    case "16:9":
      return "1792x1024";
    case "1:1":
      return "1024x1024";
    case "4:5":
    default:
      return "1024x1280";
  }
}
