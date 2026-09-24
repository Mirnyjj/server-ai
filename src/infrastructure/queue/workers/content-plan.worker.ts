import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type { ContentPlanSlotJobData, StrategyRunJobData } from "../types";
import { runScheduledContentSlot } from "../../../modules/ai/plan/content-plan.service";
import { runStrategyAgent } from "../../../modules/ai/strategy/strategy.agent";
import type { ContentScenario } from "../../../modules/ai/content/scenario.types";

export function createContentPlanWorker() {
  const worker = new Worker(
    QUEUE_NAMES.CONTENT_PLAN,
    async (job) => {
      switch (job.name) {
        case JOB_NAMES.CONTENT_PLAN_SLOT: {
          const data = job.data as ContentPlanSlotJobData;
          job.log(`Content plan slot for ${data.profileId}`);
          return runScheduledContentSlot({
            profileId: data.profileId,
            postType: data.postType as ContentScenario["postType"] | undefined,
            topicHint: data.topicHint,
            autoPublish: data.autoPublish,
          });
        }
        case JOB_NAMES.STRATEGY_RUN: {
          const data = job.data as StrategyRunJobData;
          job.log(`Strategy run for ${data.profileId}`);
          return runStrategyAgent(data.profileId);
        }
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    {
      connection: getBullMqConnection(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[content-plan] completed ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[content-plan] failed ${job?.id}:`, err.message);
  });

  return worker;
}
