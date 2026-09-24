import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type {
  RefreshConnectionJobData,
  RefreshAllExpiringJobData,
} from "../types";
import { refreshInstagramConnection } from "../../../modules/instagram/auth/refresh.service";
import { prisma } from "../../../../prisma/prisma";

async function processRefreshConnection(
  job: Job<RefreshConnectionJobData>,
) {
  const { instagramAccountId } = job.data;
  job.log(`Refreshing token for account ${instagramAccountId}`);

  const result = await refreshInstagramConnection(instagramAccountId);

  job.log(`Token refreshed, expires at ${result.tokenExpiresAt.toISOString()}`);
  return result;
}

async function processRefreshAllExpiring(
  job: Job<RefreshAllExpiringJobData>,
) {
  const withinHours = job.data.withinHours ?? 24;
  const threshold = new Date(Date.now() + withinHours * 60 * 60 * 1000);

  const connections = await prisma.instagramConnection.findMany({
    where: {
      status: "ACTIVE",
      tokenExpiresAt: {
        lte: threshold,
      },
    },
    select: {
      instagramAccountId: true,
      tokenExpiresAt: true,
    },
  });

  job.log(`Found ${connections.length} connections expiring within ${withinHours}h`);

  const results: Array<{ accountId: string; ok: boolean; error?: string }> = [];

  for (const conn of connections) {
    try {
      await refreshInstagramConnection(conn.instagramAccountId);
      results.push({ accountId: conn.instagramAccountId, ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown refresh error";
      results.push({
        accountId: conn.instagramAccountId,
        ok: false,
        error: message,
      });

      await prisma.instagramConnection.update({
        where: { instagramAccountId: conn.instagramAccountId },
        data: {
          status: "ERROR",
          lastError: message,
          lastErrorAt: new Date(),
        },
      });
    }
  }

  return { refreshed: results.filter((r) => r.ok).length, results };
}

export function createTokenRefreshWorker() {
  const worker = new Worker(
    QUEUE_NAMES.TOKEN_REFRESH,
    async (job) => {
      switch (job.name) {
        case JOB_NAMES.REFRESH_CONNECTION:
          return processRefreshConnection(
            job as Job<RefreshConnectionJobData>,
          );
        case JOB_NAMES.REFRESH_ALL_EXPIRING:
          return processRefreshAllExpiring(
            job as Job<RefreshAllExpiringJobData>,
          );
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    },
    {
      connection: getBullMqConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[token-refresh] completed ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[token-refresh] failed ${job?.id} (${job?.name}):`,
      err.message,
    );
  });

  return worker;
}
