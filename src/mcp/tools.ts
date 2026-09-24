import { prisma } from "../../prisma/prisma";
import {
  isInstagramDevMode,
  isOAuthEnabled,
  isTelegramEnabled,
  isLunaEnabled,
  isWebhooksEnabled,
} from "../config/env";
import { isObjectStorageConfigured, getObjectStorage } from "../infrastructure/storage";
import {
  enqueueMediaSync,
  enqueueContentPlanSlot,
  enqueueStrategyRun,
  enqueueProcessComment,
  enqueueProcessDirectMessage,
} from "../infrastructure/queue";
import { runContentPipeline } from "../modules/ai/pipeline/content.pipeline";
import { enqueuePublishReadyPost } from "../modules/ai/pipeline/publish-from-post";
import { runScheduledContentSlot } from "../modules/ai/plan/content-plan.service";
import { runStrategyAgent } from "../modules/ai/strategy/strategy.agent";
import { processComment } from "../modules/agent/comment.agent";
import { processDirectMessage } from "../modules/agent/message.agent";
import { createReferenceService } from "../modules/ai/references/reference.service";
import type { ContentScenario } from "../modules/ai/content/scenario.types";

/** Tool handlers shared by MCP server */

export async function toolSystemStatus() {
  let storageName = "n/a";
  try {
    storageName = getObjectStorage().name;
  } catch {
    /* */
  }

  const [profiles, pendingComments, pendingDms, activeAccounts] =
    await Promise.all([
      prisma.aiProfile.count(),
      prisma.comment.count({ where: { requiresHuman: true, replied: false } }),
      prisma.directMessage.count({
        where: { requiresHuman: true, replied: false, direction: "INBOUND" },
      }),
      prisma.instagramAccount.count({ where: { status: "ACTIVE" } }),
    ]);

  return {
    instagramDevMode: isInstagramDevMode(),
    oauthEnabled: isOAuthEnabled(),
    webhooksEnabled: isWebhooksEnabled(),
    telegramEnabled: isTelegramEnabled(),
    lunaEnabled: isLunaEnabled(),
    storageConfigured: isObjectStorageConfigured(),
    storageName,
    counts: {
      profiles,
      activeAccounts,
      pendingComments,
      pendingDms,
    },
  };
}

export async function toolListProfiles() {
  const profiles = await prisma.aiProfile.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      instagramAccounts: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          id: true,
          username: true,
          instagramUserId: true,
          status: true,
        },
      },
    },
  });

  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    autonomousMode: p.autonomousMode,
    instagram: p.instagramAccounts[0] ?? null,
  }));
}

export async function toolPendingReviews(limit = 10) {
  const [comments, dms] = await Promise.all([
    prisma.comment.findMany({
      where: { requiresHuman: true, replied: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        username: true,
        text: true,
        category: true,
        suggestedReply: true,
        postId: true,
        createdAt: true,
      },
    }),
    prisma.directMessage.findMany({
      where: { requiresHuman: true, replied: false, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        thread: { select: { username: true, instagramThreadId: true } },
      },
    }),
  ]);

  return {
    comments,
    dms: dms.map((m) => ({
      id: m.id,
      text: m.text,
      category: m.category,
      suggestedReply: m.suggestedReply,
      username: m.thread.username,
      createdAt: m.createdAt,
    })),
  };
}

export async function toolSyncMedia(profileId: string) {
  const job = await enqueueMediaSync({ profileId });
  return { jobId: job.id, profileId };
}

export async function toolRunPipeline(input: {
  profileId: string;
  postType?: ContentScenario["postType"];
  topicHint?: string;
  autoPublish?: boolean;
}) {
  const result = await runContentPipeline({
    profileId: input.profileId,
    postType: input.postType,
    topicHint: input.topicHint,
  });

  let publishJob = null;
  if (input.autoPublish && result.publishReady) {
    publishJob = await enqueuePublishReadyPost(result.postId);
  }

  return { ...result, publishJob };
}

export async function toolRunPlanSlot(input: {
  profileId: string;
  postType?: ContentScenario["postType"];
  topicHint?: string;
  autoPublish?: boolean;
  async?: boolean;
}) {
  if (input.async) {
    const job = await enqueueContentPlanSlot({
      profileId: input.profileId,
      postType: input.postType,
      topicHint: input.topicHint,
      autoPublish: input.autoPublish,
    });
    return { enqueued: true, jobId: job.id };
  }
  return runScheduledContentSlot(input);
}

export async function toolRunStrategy(input: {
  profileId: string;
  async?: boolean;
}) {
  if (input.async) {
    const job = await enqueueStrategyRun({ profileId: input.profileId });
    return { enqueued: true, jobId: job.id };
  }
  return runStrategyAgent(input.profileId);
}

export async function toolPublishPost(postId: string) {
  return enqueuePublishReadyPost(postId);
}

export async function toolProcessComment(input: {
  commentId: string;
  async?: boolean;
}) {
  if (input.async) {
    const job = await enqueueProcessComment({ commentId: input.commentId });
    return { enqueued: true, jobId: job.id };
  }
  return processComment(input.commentId);
}

export async function toolProcessDm(input: {
  messageId: string;
  async?: boolean;
}) {
  if (input.async) {
    const job = await enqueueProcessDirectMessage({
      messageId: input.messageId,
    });
    return { enqueued: true, jobId: job.id };
  }
  return processDirectMessage(input.messageId);
}

export async function toolListReferences(profileId: string) {
  const service = createReferenceService();
  const pack = await service.getReferencePack(profileId);
  const consistencyPrompt = await service.buildConsistencyPrompt(profileId);
  return { pack, consistencyPrompt };
}

export async function toolAddReference(input: {
  profileId: string;
  url: string;
  type: string;
  description: string;
  priority?: number;
  tags?: string[];
}) {
  const service = createReferenceService();
  const ref = await service.addReference({
    profileId: input.profileId,
    url: input.url,
    type: input.type,
    description: input.description,
    priority: input.priority,
    tags: input.tags,
  });
  return {
    id: ref.id,
    type: ref.type,
    mediaAssetId: ref.mediaAssetId,
  };
}
