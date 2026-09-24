import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type {
  ReconcileProfileCommentsJobData,
  ReconcilePostCommentsJobData,
} from "../types";
import { resolveAccessTokenByProfileId, resolveAccessToken } from "../../../modules/instagram/auth/token.resolver";
import { createCommentReconciliationService } from "../../../modules/instagram/comments/comments.reconciliation";
import { prisma } from "../../../../prisma/prisma";

async function processProfile(job: Job<ReconcileProfileCommentsJobData>) {
  const { profileId, limit } = job.data;
  const accessToken = await resolveAccessTokenByProfileId(profileId);
  const service = createCommentReconciliationService(accessToken);

  job.log(`Reconciling comments for profile ${profileId}`);
  const result = await service.reconcileProfileComments({
    profileId,
    limit,
  });

  job.log(
    `Done: ${result.succeeded}/${result.postsProcessed} posts, +${result.totalCreated} created, ~${result.totalUpdated} updated`,
  );

  return result;
}

async function processPost(job: Job<ReconcilePostCommentsJobData>) {
  const { postId, instagramMediaId } = job.data;

  let profileId: string | undefined;

  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    profileId = post?.profileId;
  } else if (instagramMediaId) {
    const post = await prisma.post.findUnique({
      where: { instagramMediaId },
    });
    profileId = post?.profileId;
  }

  const accessToken = profileId
    ? await resolveAccessTokenByProfileId(profileId)
    : await resolveAccessToken();

  const service = createCommentReconciliationService(accessToken);
  return service.reconcilePostComments({ postId, instagramMediaId });
}

export function createCommentReconcileWorker() {
  const worker = new Worker(
    QUEUE_NAMES.COMMENT_RECONCILE,
    async (job) => {
      switch (job.name) {
        case JOB_NAMES.RECONCILE_PROFILE_COMMENTS:
          return processProfile(job as Job<ReconcileProfileCommentsJobData>);
        case JOB_NAMES.RECONCILE_POST_COMMENTS:
          return processPost(job as Job<ReconcilePostCommentsJobData>);
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
    console.log(`[comment-reconcile] completed ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[comment-reconcile] failed ${job?.id}:`, err.message);
  });

  return worker;
}
