import { prisma } from "../../../../prisma/prisma.js";
import {
  DEFAULT_POLICY,
  SENSITIVE_CATEGORIES,
  type PolicyDecision,
  type PolicyFlags,
  type AgentActionType,
  type SensitiveCategory,
} from "./policy.types.js";

/**
 * Policy Engine (TZ §21).
 *
 * Flow:
 *   Claude → structured decision
 *     → Policy Engine.evaluate()
 *       → if allowed → Meta Provider / Graph API
 *       → if denied → escalate / ignore / log
 *
 * Claude never calls Meta API directly.
 */
export class PolicyEngine {
  constructor(private readonly flags: PolicyFlags = DEFAULT_POLICY) {}

  static default(): PolicyEngine {
    return new PolicyEngine(DEFAULT_POLICY);
  }

  /**
   * Load policy for a profile.
   * Policy can later be stored on AiProfile — for now defaults + autonomousMode.
   */
  static async forProfile(profileId: string): Promise<PolicyEngine> {
    const profile = await prisma.aiProfile.findUnique({
      where: { id: profileId },
      select: { autonomousMode: true, contentStrategy: true },
    });

    const flags: PolicyFlags = { ...DEFAULT_POLICY };

    if (profile && !profile.autonomousMode) {
      // Autonomous off → block outbound agent actions
      flags.replyToComments = false;
      flags.replyToMessages = false;
      flags.publishContent = false;
    }

    // Optional overrides from contentStrategy.policy if present
    const strategy = profile?.contentStrategy as
      | { policy?: Partial<PolicyFlags> }
      | null;
    if (strategy?.policy) {
      Object.assign(flags, strategy.policy);
    }

    // Hard safety: cold outreach always forbidden
    flags.sendOutboundColdMessages = false;

    return new PolicyEngine(flags);
  }

  getFlags(): Readonly<PolicyFlags> {
    return this.flags;
  }

  /** Generic action gate */
  can(action: AgentActionType): PolicyDecision {
    const allowed = this.flags[action];
    if (!allowed) {
      return {
        allowed: false,
        reason: `Action "${action}" is disabled by policy`,
        code: "POLICY_DISABLED",
      };
    }
    return { allowed: true };
  }

  /**
   * Evaluate a comment reply decision from the agent.
   */
  evaluateCommentReply(input: {
    action: "reply" | "ignore" | "escalate";
    category?: string | null;
    confidence?: number | null;
    requiresHuman?: boolean;
    alreadyReplied?: boolean;
    /** Minimum confidence to auto-reply (default 0.7) */
    minConfidence?: number;
  }): PolicyDecision {
    const gate = this.can("replyToComments");
    if (!gate.allowed) return gate;

    if (input.alreadyReplied) {
      return {
        allowed: false,
        reason: "Comment already replied",
        code: "ALREADY_REPLIED",
      };
    }

    if (input.action === "ignore") {
      return { allowed: false, reason: "Agent chose ignore", code: "POLICY_DISABLED" };
    }

    if (input.action === "escalate" || input.requiresHuman) {
      return {
        allowed: false,
        reason: "Requires human review",
        code: "REQUIRES_HUMAN",
      };
    }

    if (input.category && isSensitiveCategory(input.category)) {
      return {
        allowed: false,
        reason: `Sensitive category: ${input.category}`,
        code: "SENSITIVE_CATEGORY",
      };
    }

    const min = input.minConfidence ?? 0.7;
    if (
      input.confidence !== undefined &&
      input.confidence !== null &&
      input.confidence < min
    ) {
      return {
        allowed: false,
        reason: `Confidence ${input.confidence} < ${min}`,
        code: "LOW_CONFIDENCE",
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluate a DM reply (TZ §24–25).
   * Messaging window / cold outreach checks are structural — not just policy flags.
   */
  evaluateMessageReply(input: {
    action: "reply" | "ignore" | "escalate";
    category?: string | null;
    confidence?: number | null;
    requiresHuman?: boolean;
    alreadyReplied?: boolean;
    /** True if user messaged us within Meta messaging window */
    withinMessagingWindow?: boolean;
    isColdOutreach?: boolean;
    minConfidence?: number;
  }): PolicyDecision {
    const gate = this.can("replyToMessages");
    if (!gate.allowed) return gate;

    if (input.isColdOutreach || input.withinMessagingWindow === false) {
      return {
        allowed: false,
        reason: "Outside Meta messaging window / cold outreach forbidden",
        code: input.isColdOutreach
          ? "COLD_OUTREACH_FORBIDDEN"
          : "MESSAGING_WINDOW",
      };
    }

    if (input.alreadyReplied) {
      return {
        allowed: false,
        reason: "Message already replied",
        code: "ALREADY_REPLIED",
      };
    }

    if (input.action === "ignore") {
      return { allowed: false, reason: "Agent chose ignore", code: "POLICY_DISABLED" };
    }

    if (input.action === "escalate" || input.requiresHuman) {
      return {
        allowed: false,
        reason: "Requires human review",
        code: "REQUIRES_HUMAN",
      };
    }

    if (input.category && isSensitiveCategory(input.category)) {
      return {
        allowed: false,
        reason: `Sensitive category: ${input.category}`,
        code: "SENSITIVE_CATEGORY",
      };
    }

    const min = input.minConfidence ?? 0.7;
    if (
      input.confidence !== undefined &&
      input.confidence !== null &&
      input.confidence < min
    ) {
      return {
        allowed: false,
        reason: `Confidence ${input.confidence} < ${min}`,
        code: "LOW_CONFIDENCE",
      };
    }

    return { allowed: true };
  }
}

function isSensitiveCategory(category: string): category is SensitiveCategory {
  return (SENSITIVE_CATEGORIES as readonly string[]).includes(
    category.toLowerCase(),
  );
}

export function createPolicyEngine(flags?: Partial<PolicyFlags>): PolicyEngine {
  return new PolicyEngine({ ...DEFAULT_POLICY, ...flags });
}
