import type { AgentToolName } from "../../mcp/tools.js";

export type AgentRole =
  | "platform"
  | "content"
  | "analytics"
  | "community";

export type AgentPlannedCall = {
  tool: AgentToolName;
  arguments?: Record<string, unknown>;
};

export type AgentPlan = {
  calls: AgentPlannedCall[];
  reply?: string;
};

export type AgentRunResult = {
  role: AgentRole;
  reply: string;
  calls: Array<{
    tool: AgentToolName;
    ok: boolean;
    result?: unknown;
    error?: string;
  }>;
};
