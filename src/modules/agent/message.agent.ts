import { prisma } from "../../../prisma/prisma";
import { env } from "../../config/env";
import { resolveAccessTokenByProfileId } from "../instagram/auth/token.resolver";
import { createInstagramClient } from "../instagram/client/instagram.client";
import { notifySensitiveDm } from "../telegram/telegram.notify";
import { PolicyEngine } from "./policy/policy.engine";
import type { MessageAgentDecision, AgentRunResult } from "./types";
import { runLunaMessageDecision } from "./luna/message.decision";

export async function processDirectMessage(
  messageId: string,
): Promise<AgentRunResult<MessageAgentDecision>> {
  const message = await prisma.directMessage.findUnique({
    where: { id: messageId },
    include: {
      thread: {
        include: {
          account: {
            include: { profile: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!message) {
    throw new Error(`DirectMessage ${messageId} not found`);
  }

  if (message.direction !== "INBOUND") {
    throw new Error("Only inbound messages are processed by DM agent");
  }

  const profile = message.thread.account.profile;
  const policy = await PolicyEngine.forProfile(profile.id);

  if (message.replied) {
    return {
      decision: {
        action: "ignore",
        category: message.category ?? "unknown",
        confidence: message.aiConfidence ?? 1,
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

  const lastInbound = message.thread.messages.find(
    (m) => m.direction === "INBOUND",
  );
  const withinMessagingWindow = lastInbound
    ? Date.now() - lastInbound.createdAt.getTime() < 24 * 60 * 60 * 1000
    : false;

  const history = message.thread.messages
    .slice()
    .reverse()
    .map((m) => ({
      direction: m.direction,
      text: m.text,
    }));

  const decision = await runLunaMessageDecision({
    persona: profile.persona,
    writingStyle: profile.writingStyle,
    messageText: message.text,
    username: message.thread.username,
    history,
  });

  await prisma.directMessage.update({
    where: { id: message.id },
    data: {
      category: decision.category,
      aiConfidence: decision.confidence,
      requiresHuman: decision.requiresHuman,
      suggestedReply: decision.reply,
    },
  });

  const evaluation = policy.evaluateMessageReply({
    action: decision.action,
    category: decision.category,
    confidence: decision.confidence,
    requiresHuman: decision.requiresHuman,
    alreadyReplied: message.replied,
    withinMessagingWindow,
    isColdOutreach: !withinMessagingWindow,
  });

  if (!evaluation.allowed) {
    if (
      evaluation.code === "REQUIRES_HUMAN" ||
      evaluation.code === "SENSITIVE_CATEGORY" ||
      evaluation.code === "LOW_CONFIDENCE"
    ) {
      await prisma.directMessage.update({
        where: { id: message.id },
        data: { requiresHuman: true },
      });

      void notifySensitiveDm({
        messageId: message.id,
        username: message.thread.username,
        text: message.text,
        category: decision.category,
        suggestedReply: decision.reply,
      }).catch((err) => console.error("[telegram] notify dm failed", err));
    }

    await logAgentAction(profile.id, "dm.decide", {
      messageId,
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

      const result = await client.sendMessage(
        message.thread.account.instagramUserId,
        message.thread.instagramThreadId,
        decision.reply,
      );

      await prisma.directMessage.update({
        where: { id: message.id },
        data: { replied: true, requiresHuman: false },
      });

      if (result.message_id) {
        await prisma.directMessage.create({
          data: {
            threadId: message.threadId,
            instagramMessageId: result.message_id,
            text: decision.reply,
            direction: "OUTBOUND",
            replied: true,
          },
        });
      }

      await logAgentAction(profile.id, "dm.reply", {
        messageId,
        decision,
        externalId: result.message_id,
      });

      return {
        decision,
        policyAllowed: true,
        executed: true,
        externalId: result.message_id,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "send failed";
      await logAgentAction(
        profile.id,
        "dm.reply",
        { messageId, decision },
        errMsg,
      );

      return {
        decision,
        policyAllowed: true,
        executed: false,
        executionError: errMsg,
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
