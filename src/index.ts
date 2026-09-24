import { createApp } from "./app";
import { env } from "./config/env";
import { startWorkers, stopWorkers, closeAllQueues } from "./infrastructure/queue";
import { closeRedisConnection } from "./infrastructure/redis";

const app = await createApp();

// Start BullMQ workers in the same process (simple deployment).
// For horizontal scaling, run workers in a separate process via `npm run worker`.
const workers = startWorkers();

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down…`);

  try {
    await app.close();
    await stopWorkers();
    await closeAllQueues();
    await closeRedisConnection();
  } catch (error) {
    app.log.error(error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT,
  });

  app.log.info(`Workers running: ${workers.length}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
