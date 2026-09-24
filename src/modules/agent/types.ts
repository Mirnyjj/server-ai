/** Structured agent output for comments (TZ §20) */
export type CommentAgentDecision = {
  action: "reply" | "ignore" | "escalate";
  category: string;
  confidence: number;
  reply: string | null;
  requiresHuman: boolean;
  reasoning?: string;
};

/** Structured agent output for DMs (TZ §22–25) */
export type MessageAgentDecision = {
  action: "reply" | "ignore" | "escalate";
  category: string;
  confidence: number;
  reply: string | null;
  requiresHuman: boolean;
  reasoning?: string;
};

export type AgentRunResult<T> = {
  decision: T;
  policyAllowed: boolean;
  policyReason?: string;
  policyCode?: string;
  executed: boolean;
  executionError?: string;
  /** Instagram reply id if executed */
  externalId?: string;
};
