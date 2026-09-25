/**
 * LLM Provider abstraction.
 * Primary implementation: GPT-6 Luna (content scenarios, analytics, agent decisions).
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
};

export type LlmTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type LlmJsonRequest = {
  messages: LlmMessage[];
  /** Soft hint for structured output */
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
};

export type LlmToolRequest = {
  messages: LlmMessage[];
  tools: LlmTool[];
  temperature?: number;
  maxTokens?: number;
};

export type LlmToolResponse = {
  content: string;
  toolCalls: LlmToolCall[];
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
};

export type LlmJsonResponse<T = unknown> = {
  data: T;
  raw: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
};

export interface LlmProvider {
  readonly name: string;
  completeJson<T>(request: LlmJsonRequest): Promise<LlmJsonResponse<T>>;
  completeText(request: Omit<LlmJsonRequest, "schemaName">): Promise<string>;
  completeWithTools(request: LlmToolRequest): Promise<LlmToolResponse>;
}
