import { prisma } from "../../prisma/prisma.js";
import {
  isInstagramDevMode,
  isOAuthEnabled,
  isTelegramEnabled,
  isLunaEnabled,
  isWebhooksEnabled,
} from "../config/env.js";
import {
  isObjectStorageConfigured,
  getObjectStorage,
} from "../infrastructure/storage/index.js";
import {
  enqueueMediaSync,
  enqueueContentPlanSlot,
  enqueueStrategyRun,
  enqueueProcessComment,
  enqueueProcessDirectMessage,
  enqueueContentGeneration,
} from "../infrastructure/queue/index.js";
import { runContentPipeline } from "../modules/ai/pipeline/content.pipeline.js";
import { enqueuePublishReadyPost } from "../modules/ai/pipeline/publish-from-post.js";
import { runScheduledContentSlot } from "../modules/ai/plan/content-plan.service.js";
import { runStrategyAgent } from "../modules/ai/strategy/strategy.agent.js";
import { processComment } from "../modules/agent/comment.agent.js";
import { processDirectMessage } from "../modules/agent/message.agent.js";
import { createReferenceService } from "../modules/ai/references/reference.service.js";
import { searchWeb } from "../modules/ai/search/search.service.js";
import type { ContentScenario } from "../modules/ai/content/scenario.types.js";

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
  async?: boolean;
}) {
  if (input.autoPublish) {
    throw new Error(
      "Automatic publishing is disabled. The post must be approved explicitly before publishing.",
    );
  }

  if (input.async) {
    const job = await enqueueContentGeneration({
      profileId: input.profileId,
      postType: input.postType,
      topicHint: input.topicHint,
    });
    return { enqueued: true, jobId: job.id };
  }

  const result = await runContentPipeline({
    profileId: input.profileId,
    postType: input.postType,
    topicHint: input.topicHint,
  });

  return { ...result, publishJob: null };
}

export async function toolRunPlanSlot(input: {
  profileId: string;
  postType?: ContentScenario["postType"];
  topicHint?: string;
  autoPublish?: boolean;
  async?: boolean;
}) {
  if (input.autoPublish) {
    throw new Error(
      "Automatic publishing is disabled. The post must be approved explicitly before publishing.",
    );
  }

  if (input.async) {
    const job = await enqueueContentPlanSlot({
      profileId: input.profileId,
      postType: input.postType,
      topicHint: input.topicHint,
      autoPublish: false,
    });
    return { enqueued: true, jobId: job.id };
  }
  return runScheduledContentSlot({ ...input, autoPublish: false });
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

export async function toolWebSearch(input: {
  query: string;
  limit?: number;
  language?: string;
  timeRange?: "day" | "month" | "year";
}) {
  return searchWeb(input.query, {
    limit: input.limit,
    language: input.language,
    timeRange: input.timeRange,
  });
}

export type AgentToolName =
  | "system_status"
  | "list_profiles"
  | "pending_reviews"
  | "sync_media"
  | "run_pipeline"
  | "run_plan_slot"
  | "run_strategy"
  | "publish_post"
  | "process_comment"
  | "process_dm"
  | "list_references"
  | "add_reference"
  | "web_search";

export async function executeAgentTool(
  name: AgentToolName,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "system_status":
      return toolSystemStatus();
    case "list_profiles":
      return toolListProfiles();
    case "pending_reviews":
      return toolPendingReviews(
        typeof args.limit === "number" ? Math.max(1, Math.floor(args.limit)) : 10,
      );
    case "sync_media":
      return toolSyncMedia(requireToolString(args, "profileId"));
    case "run_pipeline":
      return toolRunPipeline({
        profileId: requireToolString(args, "profileId"),
        postType: parsePostType(args.postType),
        topicHint: optionalString(args, "topicHint"),
        autoPublish: optionalBoolean(args, "autoPublish"),
        async: optionalBoolean(args, "async"),
      });
    case "run_plan_slot":
      return toolRunPlanSlot({
        profileId: requireToolString(args, "profileId"),
        postType: parsePostType(args.postType),
        topicHint: optionalString(args, "topicHint"),
        autoPublish: optionalBoolean(args, "autoPublish"),
        async: optionalBoolean(args, "async"),
      });
    case "run_strategy":
      return toolRunStrategy({
        profileId: requireToolString(args, "profileId"),
        async: optionalBoolean(args, "async"),
      });
    case "publish_post":
      return toolPublishPost(requireToolString(args, "postId"));
    case "process_comment":
      return toolProcessComment({
        commentId: requireToolString(args, "commentId"),
        async: optionalBoolean(args, "async"),
      });
    case "process_dm":
      return toolProcessDm({
        messageId: requireToolString(args, "messageId"),
        async: optionalBoolean(args, "async"),
      });
    case "list_references":
      return toolListReferences(requireToolString(args, "profileId"));
    case "add_reference":
      return toolAddReference({
        profileId: requireToolString(args, "profileId"),
        url: requireToolString(args, "url"),
        type: requireToolString(args, "type"),
        description: requireToolString(args, "description"),
        priority: optionalNumber(args, "priority"),
        tags: optionalTags(args),
      });
    case "web_search":
      return toolWebSearch({
        query: requireToolString(args, "query"),
        limit: optionalNumber(args, "limit"),
        language: optionalString(args, "language"),
        timeRange: parseTimeRange(args.timeRange),
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requireToolString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function optionalString(
  args: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function optionalBoolean(
  args: Record<string, unknown>,
  name: string,
): boolean | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
  return value;
}

function optionalNumber(
  args: Record<string, unknown>,
  name: string,
): number | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function parsePostType(
  value: unknown,
): ContentScenario["postType"] | undefined {
  if (value === undefined) return undefined;
  if (
    value !== "PHOTO" &&
    value !== "REEL" &&
    value !== "STORY" &&
    value !== "CAROUSEL" &&
    value !== "VIDEO"
  ) {
    throw new Error(
      "postType must be one of: PHOTO, REEL, STORY, CAROUSEL, VIDEO",
    );
  }
  return value;
}

function parseTimeRange(
  value: unknown,
): "day" | "month" | "year" | undefined {
  if (value === undefined) return undefined;
  if (value !== "day" && value !== "month" && value !== "year") {
    throw new Error("timeRange must be one of: day, month, year");
  }
  return value;
}

function optionalTags(args: Record<string, unknown>): string[] | undefined {
  const value = args.tags;
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error("tags must be an array of strings");
  }
  return value;
}
