import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type { SyncAccountMediaJobData } from "../types";
import { resolveAccessTokenByProfileId } from "../../../modules/instagram/auth/token.resolver";
import { createInstagramMediaService } from "../../../modules/instagram/media/media.service";

async function processMediaSync(job: Job<SyncAccountMediaJobData>) {
  const { profileId } = job.data;

  const accessToken = await resolveAccessTokenByProfileId(profileId);
  const mediaService = createInstagramMediaService(accessToken);

  job.log(`Syncing media for profile ${profileId}`);
  const result = await mediaService.syncPosts(profileId);

  job.log(
    `Synced: ${result.imported} posts (${result.createdPosts} new, ${result.updatedPosts} updated)`,
  );

  return result;
}

export function createMediaSyncWorker() {
  const worker = new Worker(
    QUEUE_NAMES.MEDIA_SYNC,
    async (job) => {
      if (job.name !== JOB_NAMES.SYNC_ACCOUNT_MEDIA) {
        throw new Error(`Unknown job name: ${job.name}`);
      }
      return processMediaSync(job as Job<SyncAccountMediaJobData>);
    },
    {
      connection: getBullMqConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[media-sync] completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[media-sync] failed ${job?.id}:`, err.message);
  });

  return worker;
}
