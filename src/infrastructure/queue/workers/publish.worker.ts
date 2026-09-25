import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection.js";
import { QUEUE_NAMES, JOB_NAMES } from "../types.js";
import type { PublishPostJobData, CreateAndPublishJobData } from "../types.js";
import { enqueuePollContainer } from "../queues.js";
import { resolveAccessToken } from "../../../modules/instagram/auth/token.resolver.js";
import { createInstagramClient } from "../../../modules/instagram/client/instagram.client.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../../prisma/prisma.js";
import { PostStatus } from "../../../generated/prisma/enums.js";

async function processPublishPost(job: Job<PublishPostJobData>) {
  const { postId, instagramUserId, containerId } = job.data;

  const accessToken = await resolveAccessToken({ instagramUserId });
  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  await prisma.post.update({
    where: { id: postId },
    data: { status: PostStatus.PUBLISHING },
  });

  const result = await client.publishContainer(instagramUserId, containerId);

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: PostStatus.PUBLISHED,
      instagramMediaId: result.id,
      publishedAt: new Date(),
    },
  });

  await prisma.instagramMediaContainer.updateMany({
    where: { containerId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  job.log(`Published post ${postId} → media ${result.id}`);
  return result;
}

async function processCreateAndPublish(
  job: Job<CreateAndPublishJobData>,
) {
  const {
    postId,
    instagramUserId,
    mediaType,
    imageUrl,
    videoUrl,
    caption,
    altText,
    isAiGenerated,
    items,
  } = job.data;

  const accessToken = await resolveAccessToken({ instagramUserId });
  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  await prisma.post.update({
    where: { id: postId },
    data: { status: PostStatus.PUBLISHING },
  });

  let containerId: string;

  switch (mediaType) {
    case "IMAGE": {
      if (!imageUrl) throw new Error("imageUrl required for IMAGE");
      const container = await client.createImageContainer(
        instagramUserId,
        imageUrl,
        caption,
        altText,
        isAiGenerated,
      );
      containerId = container.id;
      break;
    }
    case "REEL":
    case "VIDEO": {
      if (!videoUrl) throw new Error("videoUrl required for REEL/VIDEO");
      const container =
        mediaType === "REEL"
          ? await client.createReelContainer(
              instagramUserId,
              videoUrl,
              caption,
              isAiGenerated,
            )
          : await client.createVideoContainer(
              instagramUserId,
              videoUrl,
              caption,
              isAiGenerated,
            );
      containerId = container.id;
      break;
    }
    case "STORY": {
      const container = await client.createStoryContainer(
        instagramUserId,
        imageUrl,
        videoUrl,
        isAiGenerated,
      );
      containerId = container.id;
      break;
    }
    case "CAROUSEL": {
      if (!items?.length) throw new Error("items required for CAROUSEL");
      const childIds: string[] = [];
      for (const item of items) {
        const child = await client.createCarouselItemContainer(
          instagramUserId,
          item,
        );
        childIds.push(child.id);
      }
      const container = await client.createCarouselContainer(
        instagramUserId,
        childIds,
        caption,
        isAiGenerated,
      );
      containerId = container.id;
      break;
    }
    default:
      throw new Error(`Unsupported mediaType: ${mediaType}`);
  }

  await prisma.instagramMediaContainer.create({
    data: {
      containerId,
      postId,
      status: "CREATED",
      mediaType,
    },
  });

  // Videos/Reels need async processing — poll status before publish
  if (mediaType === "REEL" || mediaType === "VIDEO" || mediaType === "CAROUSEL") {
    await enqueuePollContainer({
      postId,
      containerId,
      instagramUserId,
      attempt: 0,
    });
    job.log(`Container ${containerId} created — scheduled status poll`);
    return { containerId, status: "polling" };
  }

  // Images / Stories are usually ready quickly — publish now
  const result = await client.publishContainer(instagramUserId, containerId);

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: PostStatus.PUBLISHED,
      instagramMediaId: result.id,
      publishedAt: new Date(),
    },
  });

  await prisma.instagramMediaContainer.updateMany({
    where: { containerId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  job.log(`Published post ${postId} → media ${result.id}`);
  return { containerId, mediaId: result.id, status: "published" };
}

export function createPublishWorker() {
  const worker = new Worker(
    QUEUE_NAMES.PUBLISH,
    async (job) => {
      switch (job.name) {
        case JOB_NAMES.PUBLISH_POST:
          return processPublishPost(job as Job<PublishPostJobData>);
        case JOB_NAMES.CREATE_AND_PUBLISH:
          return processCreateAndPublish(job as Job<CreateAndPublishJobData>);
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    },
    {
      connection: getBullMqConnection(),
      concurrency: 3,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[publish] completed ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[publish] failed ${job?.id} (${job?.name}):`, err.message);
  });

  return worker;
}
