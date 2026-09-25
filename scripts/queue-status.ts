import "dotenv/config";

import {
  agentQueue,
  commentReconcileQueue,
  containerStatusQueue,
  contentGenerationQueue,
  contentPlanQueue,
  insightsQueue,
  mediaSyncQueue,
  publishQueue,
  tokenRefreshQueue,
  webhookQueue,
} from "../src/infrastructure/queue/index.js";

const queues = {
  tokenRefreshQueue,
  webhookQueue,
  publishQueue,
  containerStatusQueue,
  mediaSyncQueue,
  insightsQueue,
  commentReconcileQueue,
  agentQueue,
  contentPlanQueue,
  contentGenerationQueue,
};

const result: Record<string, unknown> = {};

for (const [name, queue] of Object.entries(queues)) {
  result[name] = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
  );
}

console.log(JSON.stringify(result, null, 2));

await Promise.all(Object.values(queues).map((queue) => queue.close()));
