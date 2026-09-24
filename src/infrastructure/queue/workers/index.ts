import type { Worker } from "bullmq";
import { createTokenRefreshWorker } from "./token-refresh.worker";
import { createWebhookWorker } from "./webhook.worker";
import { createPublishWorker } from "./publish.worker";
import { createContainerStatusWorker } from "./container-status.worker";
import { createMediaSyncWorker } from "./media-sync.worker";
import { createInsightsWorker } from "./insights.worker";

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  if (workers.length > 0) {
    return workers;
  }

  workers = [
    createTokenRefreshWorker(),
    createWebhookWorker(),
    createPublishWorker(),
    createContainerStatusWorker(),
    createMediaSyncWorker(),
    createInsightsWorker(),
  ];

  console.log(`[queues] started ${workers.length} workers`);
  void registerRepeatableJobs();

  return workers;
}

async function registerRepeatableJobs() {
  try {
    const { tokenRefreshQueue } = await import("../queues");
    const { JOB_NAMES } = await import("../types");

    await tokenRefreshQueue.add(
      JOB_NAMES.REFRESH_ALL_EXPIRING,
      { withinHours: 48 },
      {
        repeat: {
          every: 6 * 60 * 60 * 1000,
        },
        jobId: "repeatable-refresh-all-expiring",
      },
    );

    console.log("[queues] registered repeatable token-refresh job (every 6h)");
  } catch (error) {
    console.error("[queues] failed to register repeatable jobs:", error);
  }
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  console.log("[queues] all workers stopped");
}

export {
  createTokenRefreshWorker,
  createWebhookWorker,
  createPublishWorker,
  createContainerStatusWorker,
  createMediaSyncWorker,
  createInsightsWorker,
};
