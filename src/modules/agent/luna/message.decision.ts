import { getBrainLlm } from "../../ai/llm/provider";
import type { MessageAgentDecision } from "../types";

export async function runLunaMessageDecision(input: {
  persona: unknown;
  writingStyle: unknown;
  messageText: string;
  username?: string | null;
  history: Array<{ direction: string; text: string }>;
}): Promise<MessageAgentDecision> {
  const llm = getBrainLlm();

  try {
    const result = await llm.completeJson<MessageAgentDecision>({
      schemaName: "MessageAgentDecision",
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Decide how to handle this Instagram DM as the AI persona",
            rules: [
              "JSON only",
              "action: reply | ignore | escalate",
              "Sensitive (legal, medical, financial, threat, sexual, personal_data) → escalate",
              "Do not request or share private data",
              "Match persona writingStyle",
            ],
            persona: input.persona,
            writingStyle: input.writingStyle,
            username: input.username,
            history: input.history.slice(-8),
            message: input.messageText,
            outputSchema: {
              action: "reply|ignore|escalate",
              category: "string",
              confidence: 0.0,
              reply: "string|null",
              requiresHuman: false,
              reasoning: "string",
            },
          }),
        },
      ],
    });

    if ((result.data as { _stub?: boolean })._stub) {
      return fallback(input.messageText);
    }

    return normalize(result.data);
  } catch (error) {
    console.error("[luna] message decision failed, using fallback", error);
    return fallback(input.messageText);
  }
}

function normalize(d: MessageAgentDecision): MessageAgentDecision {
  const action =
    d.action === "reply" || d.action === "ignore" || d.action === "escalate"
      ? d.action
      : "escalate";

  return {
    action,
    category: d.category ?? "unknown",
    confidence:
      typeof d.confidence === "number"
        ? Math.min(1, Math.max(0, d.confidence))
        : 0.5,
    reply: action === "reply" ? d.reply ?? null : null,
    requiresHuman: Boolean(d.requiresHuman) || action === "escalate",
    reasoning: d.reasoning,
  };
}

function fallback(messageText: string): MessageAgentDecision {
  const text = messageText.trim().toLowerCase();
  const sensitive = [
    "lawyer",
    "sue",
    "medical",
    "kill",
    "suicide",
    "password",
    "bank",
    "nude",
  ];

  if (sensitive.some((h) => text.includes(h))) {
    return {
      action: "escalate",
      category: "high_risk",
      confidence: 0.9,
      reply: null,
      requiresHuman: true,
      reasoning: "Fallback sensitive",
    };
  }

  return {
    action: "reply",
    category: "general",
    confidence: 0.65,
    reply: "Thanks for your message! I'll get back to you soon.",
    requiresHuman: false,
    reasoning: "Fallback (Luna unavailable)",
  };
}
