import { getBrainLlm } from "../../ai/llm/provider.js";
import type { CommentAgentDecision } from "../types.js";

/**
 * Comment decision via GPT-6 Luna (structured JSON).
 * Falls back to safe heuristics if Luna unavailable / invalid JSON.
 */
export async function runLunaCommentDecision(input: {
  persona: unknown;
  writingStyle: unknown;
  commentText: string;
  commentUsername?: string | null;
  postCaption?: string | null;
  postType?: string;
}): Promise<CommentAgentDecision> {
  const llm = getBrainLlm();

  try {
    const result = await llm.completeJson<CommentAgentDecision>({
      schemaName: "CommentAgentDecision",
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Decide how to handle this Instagram comment as the AI persona",
            rules: [
              "Respond with JSON only",
              "action: reply | ignore | escalate",
              "Never engage politics, medical, legal, financial, threats, harassment, sexual_safety, personal_data",
              "Spam / empty / emoji-only → ignore",
              "If unsure or sensitive → escalate, requiresHuman true, reply null",
              "confidence 0..1",
              "reply must match writingStyle and persona when action=reply",
            ],
            persona: input.persona,
            writingStyle: input.writingStyle,
            post: {
              type: input.postType,
              caption: input.postCaption,
            },
            comment: {
              username: input.commentUsername,
              text: input.commentText,
            },
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
      return heuristicFallback(input.commentText, input.writingStyle);
    }

    return normalizeDecision(result.data);
  } catch (error) {
    console.error("[luna] comment decision failed, using fallback", error);
    return heuristicFallback(input.commentText, input.writingStyle);
  }
}

function normalizeDecision(d: CommentAgentDecision): CommentAgentDecision {
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

function heuristicFallback(
  commentText: string,
  writingStyle: unknown,
): CommentAgentDecision {
  const text = commentText.trim().toLowerCase();
  const sensitive = [
    "lawyer",
    "sue",
    "kill",
    "suicide",
    "medical",
    "diagnose",
    "investment",
    "politics",
    "election",
  ];

  if (sensitive.some((h) => text.includes(h))) {
    return {
      action: "escalate",
      category: "high_risk",
      confidence: 0.9,
      reply: null,
      requiresHuman: true,
      reasoning: "Fallback: sensitive keyword",
    };
  }

  if (text.length < 2) {
    return {
      action: "ignore",
      category: "spam",
      confidence: 0.85,
      reply: null,
      requiresHuman: false,
    };
  }

  const style = writingStyle as { tone?: string } | null;
  const reply =
    style?.tone === "witty"
      ? "Appreciate that 🙌"
      : text.includes("?")
        ? "Great question — thanks for asking!"
        : "Thank you! 🙏";

  return {
    action: "reply",
    category: "positive",
    confidence: 0.7,
    reply,
    requiresHuman: false,
    reasoning: "Fallback heuristic (Luna unavailable)",
  };
}
