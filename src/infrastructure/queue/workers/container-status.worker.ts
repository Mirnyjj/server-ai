import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type { PollContainerJobData } from "../types";
import { enqueuePollContainer, enqueuePublishPost } from "../queues";
import { resolveAccessToken } from "../../../modules/instagram/auth/token.resolver";
import { createInstagramClient } from "../../../modules/instagram/client/instagram.client";
import { env } from "../../../config/env";
import { prisma } from "../../../../prisma/prisma";
import { PostStatus } from "../../../generated/prisma/enums";

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 30_000; // 30s between polls

async function processPollContainer(job: Job<PollContainerJobData>) {
  const { postId, containerId, instagramUserId, attempt = 0 } = job.data;

  const accessToken = await resolveAccessToken({ instagramUserId });
  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  const status = await client.getContainerStatus(containerId);
  const statusCode = status.status_code ?? "UNKNOWN";

  await prisma.instagramMediaContainer.updateMany({
    where: { containerId },
    data: {
      status:
        statusCode === "FINISHED"
          ? "FINISHED"
          : statusCode === "ERROR"
            ? "ERROR"
            : statusCode === "EXPIRED"
              ? "EXPIRED"
              : statusCode === "PUBLISHED"
                ? "PUBLISHED"
                : "IN_PROGRESS",
      lastCheckedAt: new Date(),
      error: statusCode === "ERROR" ? "Container processing failed" : null,
    },
  });

  job.log(`Container ${containerId} status: ${statusCode} (attempt ${attempt})`);

  if (statusCode === "FINISHED") {
    // Ready to publish
    await enqueuePublishPost({
      postId,
      instagramUserId,
      containerId,
    });
    return { status: statusCode, action: "enqueued_publish" };
  }

  if (statusCode === "ERROR" || statusCode === "EXPIRED") {
    await prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.FAILED },
    });
    throw new Error(`Container ${containerId} failed with status ${statusCode}`);
  }

  if (statusCode === "PUBLISHED") {
    return { status: statusCode, action: "already_published" };
  }

  // IN_PROGRESS or unknown — re-queue if under limit
  if (attempt + 1 >= MAX_POLL_ATTEMPTS) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.FAILED },
    });
    throw new Error(
      `Container ${containerId} timed out after ${MAX_POLL_ATTEMPTS} polls`,
    );
  }

  await enqueuePollContainer(
    {
      postId,
      containerId,
      instagramUserId,
      attempt: attempt + 1,
    },
    { delay: POLL_INTERVAL_MS },
  );

  return { status: statusCode, action: "requeued", nextAttempt: attempt + 1 };
}

export function createContainerStatusWorker() {
  const worker = new Worker(
    QUEUE_NAMES.CONTAINER_STATUS,
    async (job) => {
      if (job.name !== JOB_NAMES.POLL_CONTAINER) {
        throw new Error(`Unknown job name: ${job.name}`);
      }
      return processPollContainer(job as Job<PollContainerJobData>);
    },
    {
      connection: getBullMqConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[container-status] completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[container-status] failed ${job?.id}:`, err.message);
  });

  return worker;
}
