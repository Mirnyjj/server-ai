import { Worker } from "bullmq";
import { getBullMqConnection } from "../connection.js";
import { JOB_NAMES, QUEUE_NAMES, type ContentGenerationJobData } from "../types.js";
import { runContentPipeline } from "../../../modules/ai/pipeline/content.pipeline.js";
import type { ContentScenario } from "../../../modules/ai/content/scenario.types.js";

export function createContentGenerationWorker() {
  const worker = new Worker(
    QUEUE_NAMES.CONTENT_GENERATION,
    async (job) => {
      if (job.name !== JOB_NAMES.CONTENT_GENERATION) {
        throw new Error(`Unknown job: ${job.name}`);
      }

      const data = job.data as ContentGenerationJobData;
      job.log(`Content generation for ${data.profileId}`);
      await job.updateProgress(10);

      const result = await runContentPipeline({
        profileId: data.profileId,
        postType: data.postType as ContentScenario["postType"] | undefined,
        topicHint: data.topicHint,
        scenario: data.scenario as ContentScenario | undefined,
      });

      await job.updateProgress(100);
      return result;
    },
    {
      connection: getBullMqConnection(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[content-generation] completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[content-generation] failed ${job?.id}:`, err.message);
  });

  return worker;
}
