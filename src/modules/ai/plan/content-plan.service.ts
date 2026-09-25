import { prisma } from "../../../../prisma/prisma.js";
import { runContentPipeline } from "../pipeline/content.pipeline.js";
import { enqueuePublishReadyPost } from "../pipeline/publish-from-post.js";
import type { ContentScenario } from "../content/scenario.types.js";

/**
 * Run one "planned" content slot for a profile.
 * Uses contentStrategy for postType rotation when no override.
 */
export async function runScheduledContentSlot(input: {
  profileId: string;
  postType?: ContentScenario["postType"];
  topicHint?: string;
  autoPublish?: boolean;
}) {
  const profile = await prisma.aiProfile.findUnique({
    where: { id: input.profileId },
  });
  if (!profile) throw new Error(`Profile ${input.profileId} not found`);

  if (!profile.autonomousMode) {
    return {
      skipped: true,
      reason: "autonomousMode is false",
    };
  }

  const strategy = profile.contentStrategy as {
    preferredFormats?: string[];
    topics?: string[];
  } | null;

  const formats = strategy?.preferredFormats ?? ["PHOTO", "REEL"];
  const postType =
    input.postType ??
    (formats[Math.floor(Math.random() * formats.length)] as ContentScenario["postType"]);

  const topics = strategy?.topics ?? [];
  const topicHint =
    input.topicHint ??
    (topics.length
      ? topics[Math.floor(Math.random() * topics.length)]
      : undefined);

  const result = await runContentPipeline({
    profileId: input.profileId,
    postType,
    topicHint,
  });

  let publishJob = null;
  if (input.autoPublish !== false && result.publishReady) {
    publishJob = await enqueuePublishReadyPost(result.postId);
  }

  await prisma.agentAction.create({
    data: {
      profileId: input.profileId,
      action: "content.plan.slot",
      status: "SUCCESS",
      input: { postType, topicHint, autoPublish: input.autoPublish } as object,
      output: {
        postId: result.postId,
        publishJob,
        publishReady: result.publishReady,
      } as object,
    },
  });

  return {
    skipped: false,
    ...result,
    publishJob,
  };
}
