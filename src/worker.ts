/**
 * Standalone worker process.
 * Use when you want API and workers on separate machines/processes:
 *
 *   npm run worker
 */
import {
  startWorkers,
  stopWorkers,
  closeAllQueues,
} from "./infrastructure/queue/index.js";
import { closeRedisConnection } from "./infrastructure/redis.js";

console.log("[worker] starting BullMQ workers…");

const workers = startWorkers();

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down…`);
  await stopWorkers();
  await closeAllQueues();
  await closeRedisConnection();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`[worker] ${workers.length} workers online`);
