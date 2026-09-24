import { env } from "../../../config/env";
import type {
  LlmJsonRequest,
  LlmJsonResponse,
  LlmMessage,
  LlmProvider,
} from "./types";

/**
 * GPT-6 Luna — primary brain.
 * Assumes OpenAI-compatible Chat Completions API.
 * If LUNA_API_KEY is missing → deterministic stub (dev).
 */
export function createLunaProvider(): LlmProvider {
  const apiKey = env.LUNA_API_KEY;
  const baseUrl = (env.LUNA_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = env.LUNA_MODEL ?? "gpt-6-luna";

  async function chat(
    messages: LlmMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usage?: LlmJsonResponse["usage"] }> {
    if (!apiKey) {
      return {
        content: JSON.stringify({
          _stub: true,
          message: "LUNA_API_KEY not set — stub response",
        }),
      };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.4,
        max_tokens: options?.maxTokens ?? 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Luna API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      model?: string;
    };

    const content = json.choices?.[0]?.message?.content ?? "{}";
    return {
      content,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
      },
    };
  }

  return {
    name: `luna:${model}`,

    async completeJson<T>(
      request: LlmJsonRequest,
    ): Promise<LlmJsonResponse<T>> {
      const systemHint: LlmMessage = {
        role: "system",
        content:
          "You are GPT-6 Luna, the orchestration brain for an AI Instagram persona. Always respond with valid JSON only.",
      };

      const messages = [systemHint, ...request.messages];
      const result = await chat(messages, {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      let data: T;
      try {
        data = JSON.parse(result.content) as T;
      } catch {
        throw new Error(
          `Luna returned non-JSON: ${result.content.slice(0, 200)}`,
        );
      }

      return {
        data,
        raw: result.content,
        model,
        usage: result.usage,
      };
    },

    async completeText(request) {
      if (!apiKey) {
        return "[Luna stub] Set LUNA_API_KEY for real completions.";
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
        }),
      });

      if (!response.ok) {
        const text = await response.text();

        throw new Error(`Luna API error ${response.status}: ${text}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      return json.choices?.[0]?.message?.content ?? "";
    },
  };
}

let singleton: LlmProvider | null = null;

export function getLuna(): LlmProvider {
  if (!singleton) singleton = createLunaProvider();
  return singleton;
}
