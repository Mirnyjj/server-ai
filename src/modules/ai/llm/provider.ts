import { getLuna } from "./luna.client.js";
import type { LlmProvider } from "./types.js";

/**
 * Resolve the brain LLM. Currently always Luna.
 * Swap here if multiple brains are needed later.
 */
export function getBrainLlm(): LlmProvider {
  return getLuna();
}

export type { LlmProvider, LlmMessage, LlmJsonRequest, LlmJsonResponse } from "./types.js";
