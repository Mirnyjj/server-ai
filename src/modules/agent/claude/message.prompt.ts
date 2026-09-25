import type { MessageAgentDecision } from "../types.js";

/**
 * Claude DM decision (TZ §22–25).
 * MVP stub — swap for Anthropic structured output when API key present.
 */
export async function runClaudeMessageDecision(input: {
  persona: unknown;
  writingStyle: unknown;
  messageText: string;
  username?: string | null;
  history: Array<{ direction: string; text: string }>;
}): Promise<MessageAgentDecision> {
  const text = input.messageText.trim().toLowerCase();

  const sensitiveHints = [
    "lawyer",
    "sue",
    "medical",
    "diagnose",
    "kill",
    "suicide",
    "bank account",
    "password",
    "ssn",
    "nude",
    "sexual",
  ];

  if (sensitiveHints.some((h) => text.includes(h))) {
    return {
      action: "escalate",
      category: "high_risk",
      confidence: 0.92,
      reply: null,
      requiresHuman: true,
      reasoning: "Sensitive content — escalate to human",
    };
  }

  if (text.length < 1) {
    return {
      action: "ignore",
      category: "empty",
      confidence: 0.9,
      reply: null,
      requiresHuman: false,
    };
  }

  return {
    action: "reply",
    category: "general",
    confidence: 0.72,
    reply: "Thanks for your message! I'll get back to you soon.",
    requiresHuman: false,
    reasoning: "Stub DM agent — wire Anthropic for production",
  };
}
