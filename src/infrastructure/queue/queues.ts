import { Queue } from "bullmq";
import { getBullMqConnection, defaultJobOptions } from "./connection";
import {
  QUEUE_NAMES,
  JOB_NAMES,
  type RefreshConnectionJobData,
  type RefreshAllExpiringJobData,
  type ProcessWebhookEventJobData,
  type PublishPostJobData,
  type CreateAndPublishJobData,
  type PollContainerJobData,
  type SyncAccountMediaJobData,
  type CollectProfileInsightsJobData,
  type CollectPostInsightsJobData,
} from "./types";

const connection = getBullMqConnection();

function createQueue(name: string) {
  return new Queue(name, {
    connection,
    defaultJobOptions,
  });
}

export const tokenRefreshQueue = createQueue(QUEUE_NAMES.TOKEN_REFRESH);
export const webhookQueue = createQueue(QUEUE_NAMES.WEBHOOK);
export const publishQueue = createQueue(QUEUE_NAMES.PUBLISH);
export const containerStatusQueue = createQueue(QUEUE_NAMES.CONTAINER_STATUS);
export const mediaSyncQueue = createQueue(QUEUE_NAMES.MEDIA_SYNC);
export const insightsQueue = createQueue(QUEUE_NAMES.INSIGHTS);

export async function enqueueTokenRefresh(
  data: RefreshConnectionJobData,
  opts?: { delay?: number; jobId?: string },
) {
  return tokenRefreshQueue.add(JOB_NAMES.REFRESH_CONNECTION, data, {
    jobId: opts?.jobId ?? `refresh-${data.instagramAccountId}`,
    delay: opts?.delay,
  });
}

export async function enqueueRefreshAllExpiring(
  data: RefreshAllExpiringJobData = {},
) {
  return tokenRefreshQueue.add(JOB_NAMES.REFRESH_ALL_EXPIRING, data, {
    jobId: `refresh-all-${Date.now()}`,
  });
}

export async function enqueueWebhookEvent(data: ProcessWebhookEventJobData) {
  return webhookQueue.add(JOB_NAMES.PROCESS_WEBHOOK_EVENT, data, {
    jobId: `webhook-${data.webhookEventId}`,
  });
}

export async function enqueuePublishPost(data: PublishPostJobData) {
  return publishQueue.add(JOB_NAMES.PUBLISH_POST, data, {
    jobId: `publish-${data.postId}-${data.containerId}`,
  });
}

export async function enqueueCreateAndPublish(data: CreateAndPublishJobData) {
  return publishQueue.add(JOB_NAMES.CREATE_AND_PUBLISH, data, {
    jobId: `create-publish-${data.postId}`,
  });
}

export async function enqueuePollContainer(
  data: PollContainerJobData,
  opts?: { delay?: number },
) {
  const attempt = data.attempt ?? 0;
  return containerStatusQueue.add(
    JOB_NAMES.POLL_CONTAINER,
    { ...data, attempt },
    {
      jobId: `poll-${data.containerId}-${attempt}`,
      delay: opts?.delay ?? 15_000,
    },
  );
}

export async function enqueueMediaSync(data: SyncAccountMediaJobData) {
  return mediaSyncQueue.add(JOB_NAMES.SYNC_ACCOUNT_MEDIA, data, {
    jobId: `media-sync-${data.profileId}-${Date.now()}`,
  });
}

export async function enqueueCollectInsights(
  data: CollectProfileInsightsJobData,
) {
  return insightsQueue.add(JOB_NAMES.COLLECT_PROFILE_INSIGHTS, data, {
    jobId: `insights-profile-${data.profileId}-${Date.now()}`,
  });
}

export async function enqueueCollectPostInsights(
  data: CollectPostInsightsJobData,
) {
  return insightsQueue.add(JOB_NAMES.COLLECT_POST_INSIGHTS, data, {
    jobId: `insights-post-${data.postId}-${Date.now()}`,
  });
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([
    tokenRefreshQueue.close(),
    webhookQueue.close(),
    publishQueue.close(),
    containerStatusQueue.close(),
    mediaSyncQueue.close(),
    insightsQueue.close(),
  ]);
}
