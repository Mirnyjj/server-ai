import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type {
  CollectProfileInsightsJobData,
  CollectPostInsightsJobData,
} from "../types";
import { resolveAccessTokenByProfileId, resolveAccessToken } from "../../../modules/instagram/auth/token.resolver";
import { createInstagramInsightsService } from "../../../modules/instagram/insights/insights.service";
import { prisma } from "../../../../prisma/prisma";

async function processProfileInsights(
  job: Job<CollectProfileInsightsJobData>,
) {
  const { profileId } = job.data;
  const accessToken = await resolveAccessTokenByProfileId(profileId);
  const service = createInstagramInsightsService(accessToken);

  job.log(`Collecting insights for profile ${profileId}`);
  const result = await service.collectProfilePostInsights(profileId);
  job.log(
    `Done: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`,
  );
  return result;
}

async function processPostInsights(job: Job<CollectPostInsightsJobData>) {
  const { postId } = job.data;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  const accessToken = await resolveAccessTokenByProfileId(post.profileId);
  const service = createInstagramInsightsService(accessToken);

  return service.collectPostInsights(postId);
}

export function createInsightsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.INSIGHTS,
    async (job) => {
      switch (job.name) {
        case JOB_NAMES.COLLECT_PROFILE_INSIGHTS:
          return processProfileInsights(
            job as Job<CollectProfileInsightsJobData>,
          );
        case JOB_NAMES.COLLECT_POST_INSIGHTS:
          return processPostInsights(job as Job<CollectPostInsightsJobData>);
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
    console.log(`[insights] completed ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[insights] failed ${job?.id}:`, err.message);
  });

  return worker;
}
