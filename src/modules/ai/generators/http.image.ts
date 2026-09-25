import { env } from "../../../config/env.js";
import type {
  ImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types.js";

type ResponsesImageGenerationCall = {
  type?: string;
  status?: string;
  result?: string;
};

type ResponsesResult = {
  id?: string;
  output?: ResponsesImageGenerationCall[];
  error?: {
    message?: string;
    code?: string;
  };
};

/**
 * Universal Responses API image generator.
 *
 * The image model is selected by IMAGE_MODEL.
 * The top-level Responses model is selected by IMAGE_MAIN_MODEL
 * and defaults to LUNA_MODEL because Responses image generation
 * uses a mainline model to invoke the image_generation tool.
 *
 * IMAGE_MODEL_BASE_URL must expose the Responses API at /responses.
 */
export function createHttpImageGenerator(): ImageGenerator {
  const imageModel = env.IMAGE_MODEL ?? "openai/gpt-image-2";
  const mainModel = env.IMAGE_MAIN_MODEL ?? env.LUNA_MODEL;
  const baseUrl = env.IMAGE_MODEL_BASE_URL;
  const apiKey = env.IMAGE_MODEL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Image model requires IMAGE_MODEL_BASE_URL and IMAGE_MODEL_API_KEY",
    );
  }

  if (!mainModel) {
    throw new Error(
      "Image model requires IMAGE_MAIN_MODEL or LUNA_MODEL for Responses API",
    );
  }

  const endpoint = new URL(
    "responses",
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();

  return {
    name: `responses:${imageModel}`,

    async generate(
      request: ImageGenerationRequest,
    ): Promise<ImageGenerationResult> {
      const prompt = buildPrompt(request);
      const content: Array<Record<string, unknown>> = [
        {
          type: "input_text",
          text: prompt,
        },
      ];

      for (const reference of request.references.slice(0, 6)) {
        if (!reference.url.startsWith("https://")) continue;

        content.push({
          type: "input_image",
          image_url: reference.url,
          detail: "auto",
        });
      }

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(120_000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: mainModel,
          input: [
            {
              role: "user",
              content,
            },
          ],
          tools: [
            {
              type: "image_generation",
              model: imageModel,
              action: "generate",
              size: aspectToSize(request.aspectRatio).value,
            },
          ],
          tool_choice: {
            type: "image_generation",
          },
        }),
      });

      const json = (await response.json()) as ResponsesResult;

      if (!response.ok) {
        const providerMessage =
          json.error?.message ?? JSON.stringify(json).slice(0, 500);

        throw new Error(
          `Image generator HTTP ${response.status}: ${providerMessage}`,
        );
      }

      const imageCall = json.output?.find(
        (output) =>
          output.type === "image_generation_call" &&
          output.status === "completed" &&
          typeof output.result === "string",
      );

      if (!imageCall?.result) {
        throw new Error(
          `Image generator response did not contain a completed image_generation_call: ${JSON.stringify(json).slice(0, 500)}`,
        );
      }

      return {
        contentBase64: imageCall.result,
        provider: "responses",
        model: imageModel,
        mimeType: "image/png",
        width: aspectToSize(request.aspectRatio).width,
        height: aspectToSize(request.aspectRatio).height,
        raw: json,
      };
    },
  };
}

function buildPrompt(request: ImageGenerationRequest): string {
  const parts = [request.prompt];

  if (request.negativePrompt) {
    parts.push(`Avoid: ${request.negativePrompt}`);
  }

  if (request.visualIdentity) {
    parts.push(
      `Visual identity: ${JSON.stringify(request.visualIdentity)}`,
    );
  }

  const referenceDescriptions = request.references
    .slice(0, 6)
    .map((reference) => `[${reference.type}] ${reference.description}`)
    .filter(Boolean);

  if (referenceDescriptions.length > 0) {
    parts.push(
      `Reference images are attached. Preserve relevant character/visual consistency. Reference notes: ${referenceDescriptions.join("; ")}`,
    );
  }

  return parts.join("\n\n");
}

type ImageSize = {
  value: string;
  width: number;
  height: number;
};

function aspectToSize(aspect?: string): ImageSize {
  switch (aspect) {
    case "9:16":
      return { value: "1024x1536", width: 1024, height: 1536 };
    case "16:9":
      return { value: "1536x1024", width: 1536, height: 1024 };
    case "1:1":
      return { value: "1024x1024", width: 1024, height: 1024 };
    case "4:5":
    default:
      return { value: "1024x1280", width: 1024, height: 1280 };
  }
}
