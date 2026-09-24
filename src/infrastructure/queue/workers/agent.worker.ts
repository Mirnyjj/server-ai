import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection";
import { QUEUE_NAMES, JOB_NAMES } from "../types";
import type {
  ProcessCommentJobData,
  ProcessDirectMessageJobData,
} from "../types";
import { processComment } from "../../../modules/agent/comment.agent";
import { processDirectMessage } from "../../../modules/agent/message.agent";

export function createAgentWorker() {
  const worker = new Worker(
    QUEUE_NAMES.AGENT,
    async (job) => {
      switch (job.name) {
        case JOB_NAMES.PROCESS_COMMENT: {
          const data = job.data as ProcessCommentJobData;
          job.log(`Processing comment ${data.commentId}`);
          const result = await processComment(data.commentId);
          job.log(
            `Done: action=${result.decision.action} executed=${result.executed} policy=${result.policyAllowed}`,
          );
          return result;
        }
        case JOB_NAMES.PROCESS_DIRECT_MESSAGE: {
          const data = job.data as ProcessDirectMessageJobData;
          job.log(`Processing DM ${data.messageId}`);
          const result = await processDirectMessage(data.messageId);
          job.log(
            `Done: action=${result.decision.action} executed=${result.executed}`,
          );
          return result;
        }
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
    console.log(`[agent] completed ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[agent] failed ${job?.id}:`, err.message);
  });

  return worker;
}
