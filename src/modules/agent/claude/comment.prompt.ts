import type { CommentAgentDecision } from "../types";

/**
 * Claude Comment decision (TZ §20).
 *
 * MVP: rule-based stub that returns structured JSON.
 * Replace body with Anthropic API call when ANTHROPIC_API_KEY is configured.
 *
 * Expected Claude output shape:
 * {
 *   "action": "reply" | "ignore" | "escalate",
 *   "category": "positive" | "question" | "spam" | "politics" | ...
 *   "confidence": 0.0-1.0,
 *   "reply": "..." | null,
 *   "requiresHuman": boolean
 * }
 */
export async function runClaudeCommentDecision(input: {
  persona: unknown;
  writingStyle: unknown;
  commentText: string;
  commentUsername?: string | null;
  postCaption?: string | null;
  postType?: string;
}): Promise<CommentAgentDecision> {
  const text = input.commentText.trim().toLowerCase();

  // Sensitive keyword heuristic (pre-filter before / instead of full Claude)
  const sensitiveHints = [
    "lawyer",
    "sue",
    "lawsuit",
    "kill",
    "suicide",
    "medical advice",
    "diagnose",
    "investment",
    "crypto scam",
    "politics",
    "election",
  ];

  if (sensitiveHints.some((h) => text.includes(h))) {
    return {
      action: "escalate",
      category: "high_risk",
      confidence: 0.9,
      reply: null,
      requiresHuman: true,
      reasoning: "Sensitive keyword detected (stub classifier)",
    };
  }

  // Spam / empty
  if (text.length < 2 || /^(.)\1{4,}$/.test(text)) {
    return {
      action: "ignore",
      category: "spam",
      confidence: 0.85,
      reply: null,
      requiresHuman: false,
      reasoning: "Likely spam or empty",
    };
  }

  // Simple positive reply stub
  const reply = craftSimpleReply(input.commentText, input.writingStyle);

  return {
    action: "reply",
    category: "positive",
    confidence: 0.75,
    reply,
    requiresHuman: false,
    reasoning:
      "Stub agent — replace with Claude when ANTHROPIC_API_KEY is set",
  };
}

function craftSimpleReply(comment: string, writingStyle: unknown): string {
  const style = writingStyle as { tone?: string } | null;
  const tone = style?.tone ?? "friendly";

  if (tone === "witty") {
    return "Appreciate that 🙌";
  }
  if (comment.includes("?")) {
    return "Great question — thanks for asking!";
  }
  return "Thank you! 🙏";
}
