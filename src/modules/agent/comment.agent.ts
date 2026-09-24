import { prisma } from "../../../prisma/prisma";
import { env } from "../../config/env";
import { resolveAccessTokenByProfileId } from "../instagram/auth/token.resolver";
import { createInstagramClient } from "../instagram/client/instagram.client";
import { notifySensitiveComment } from "../telegram/telegram.notify";
import { PolicyEngine } from "./policy/policy.engine";
import type { CommentAgentDecision, AgentRunResult } from "./types";
import { runLunaCommentDecision } from "./luna/comment.decision";

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

  if (comment.replied) {
    return {
      decision: {
        action: "ignore",
        category: comment.category ?? "unknown",
        confidence: comment.aiConfidence ?? 1,
        reply: null,
        requiresHuman: false,
        reasoning: "Already replied",
      },
      policyAllowed: false,
      policyReason: "Already replied",
      policyCode: "ALREADY_REPLIED",
      executed: false,
    };
  }

  const decision = await runLunaCommentDecision({
    persona: profile.persona,
    writingStyle: profile.writingStyle,
    commentText: comment.text,
    commentUsername: comment.username,
    postCaption: comment.post.caption,
    postType: comment.post.type,
  });

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

      void notifySensitiveComment({
        commentId: comment.id,
        username: comment.username,
        text: comment.text,
        category: decision.category,
        suggestedReply: decision.reply,
        postId: comment.postId,
      }).catch((err) => console.error("[telegram] notify comment failed", err));
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
