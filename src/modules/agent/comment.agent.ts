import { prisma } from "../../../prisma/prisma";
import { env } from "../../config/env";
import { resolveAccessTokenByProfileId } from "../instagram/auth/token.resolver";
import { createInstagramClient } from "../instagram/client/instagram.client";
import { PolicyEngine } from "./policy/policy.engine";
import type { CommentAgentDecision, AgentRunResult } from "./types";
import { runClaudeCommentDecision } from "./claude/comment.prompt";

/**
 * Comment Agent pipeline (TZ §18–21):
 *
 * Comment event
 *   → load context (persona, post, history)
 *   → Claude structured JSON
 *   → Policy Engine
 *   → if allowed → reply via Graph API + update Comment row
 *   → if denied → mark requiresHuman / ignore
 */
export async function processComment(commentId: string): Promise<
  AgentRunResult<CommentAgentDecision>
> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      post: {
        include: {
          profile: true,
          account: true,
        },
      },
    },
  });

  if (!comment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  const profile = comment.post.profile;
  const policy = await PolicyEngine.forProfile(profile.id);

  // Already handled
  if (comment.replied) {
    const decision: CommentAgentDecision = {
      action: "ignore",
      category: comment.category ?? "unknown",
      confidence: comment.aiConfidence ?? 1,
      reply: null,
      requiresHuman: false,
      reasoning: "Already replied",
    };
    return {
      decision,
      policyAllowed: false,
      policyReason: "Already replied",
      policyCode: "ALREADY_REPLIED",
      executed: false,
    };
  }

  // Claude decision
  const decision = await runClaudeCommentDecision({
    persona: profile.persona,
    writingStyle: profile.writingStyle,
    commentText: comment.text,
    commentUsername: comment.username,
    postCaption: comment.post.caption,
    postType: comment.post.type,
  });

  // Persist AI fields
  await prisma.comment.update({
    where: { id: comment.id },
    data: {
      category: decision.category,
      sentiment: decision.category,
      aiConfidence: decision.confidence,
      requiresHuman: decision.requiresHuman,
      suggestedReply: decision.reply,
    },
  });

  // Policy gate
  const evaluation = policy.evaluateCommentReply({
    action: decision.action,
    category: decision.category,
    confidence: decision.confidence,
    requiresHuman: decision.requiresHuman,
    alreadyReplied: comment.replied,
  });

  if (!evaluation.allowed) {
    if (
      evaluation.code === "REQUIRES_HUMAN" ||
      evaluation.code === "SENSITIVE_CATEGORY" ||
      evaluation.code === "LOW_CONFIDENCE"
    ) {
      await prisma.comment.update({
        where: { id: comment.id },
        data: { requiresHuman: true },
      });
    }

    await logAgentAction(profile.id, "comment.decide", {
      commentId,
      decision,
      evaluation,
    });

    return {
      decision,
      policyAllowed: false,
      policyReason: evaluation.reason,
      policyCode: evaluation.code,
      executed: false,
    };
  }

  // Execute reply
  if (decision.action === "reply" && decision.reply) {
    try {
      const accessToken = await resolveAccessTokenByProfileId(profile.id);
      const client = createInstagramClient({
        accessToken,
        apiVersion: env.INSTAGRAM_API_VERSION,
      });

      const result = await client.replyToComment(
        comment.instagramId,
        decision.reply,
      );

      await prisma.comment.update({
        where: { id: comment.id },
        data: {
          replied: true,
          replyText: decision.reply,
          requiresHuman: false,
        },
      });

      await logAgentAction(profile.id, "comment.reply", {
        commentId,
        decision,
        externalId: result.id,
      });

      return {
        decision,
        policyAllowed: true,
        executed: true,
        externalId: result.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "reply failed";
      await logAgentAction(
        profile.id,
        "comment.reply",
        { commentId, decision },
        message,
      );

      return {
        decision,
        policyAllowed: true,
        executed: false,
        executionError: message,
      };
    }
  }

  return {
    decision,
    policyAllowed: true,
    executed: false,
  };
}

async function logAgentAction(
  profileId: string,
  action: string,
  input: unknown,
  error?: string,
) {
  await prisma.agentAction.create({
    data: {
      profileId,
      action,
      input: input as object,
      status: error ? "FAILED" : "SUCCESS",
      error: error ?? null,
      output: error ? undefined : (input as object),
    },
  });
}
