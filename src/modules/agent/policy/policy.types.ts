/**
 * Policy Engine types (TZ §21).
 * Policy lives on the backend — Claude cannot change it via prompt.
 */

export type AgentActionType =
  | "publishContent"
  | "replyToComments"
  | "replyToMessages"
  | "deleteContent"
  | "deleteComment"
  | "followUsers"
  | "unfollowUsers"
  | "likeContent"
  | "sendOutboundColdMessages";

export type PolicyFlags = {
  publishContent: boolean;
  replyToComments: boolean;
  replyToMessages: boolean;
  deleteContent: boolean;
  deleteComment: boolean;
  followUsers: boolean;
  unfollowUsers: boolean;
  likeContent: boolean;
  /** Cold outreach outside messaging window — always false for Meta compliance */
  sendOutboundColdMessages: boolean;
};

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string; code: PolicyDenyCode };

export type PolicyDenyCode =
  | "POLICY_DISABLED"
  | "AUTONOMOUS_OFF"
  | "SENSITIVE_CATEGORY"
  | "LOW_CONFIDENCE"
  | "ALREADY_REPLIED"
  | "REQUIRES_HUMAN"
  | "MESSAGING_WINDOW"
  | "COLD_OUTREACH_FORBIDDEN";

/** Categories that must never be auto-replied (TZ §25) */
export const SENSITIVE_CATEGORIES = [
  "politics",
  "medical",
  "legal",
  "financial",
  "threat",
  "harassment",
  "personal_data",
  "sexual_safety",
  "high_risk",
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

export const DEFAULT_POLICY: PolicyFlags = {
  publishContent: true,
  replyToComments: true,
  replyToMessages: true,
  deleteContent: false,
  deleteComment: false,
  followUsers: false,
  unfollowUsers: false,
  likeContent: false,
  sendOutboundColdMessages: false,
};
