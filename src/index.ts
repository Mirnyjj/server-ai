import { createApp } from "./app";
import { env, isInstagramDevMode, isOAuthEnabled, isWebhooksEnabled } from "./config/env";
import { startWorkers, stopWorkers, closeAllQueues } from "./infrastructure/queue";
import { closeRedisConnection } from "./infrastructure/redis";

const app = await createApp();

const workers = startWorkers();

if (isInstagramDevMode()) {
  app.log.warn(
    "═══════════════════════════════════════════════════════════",
  );
  app.log.warn(
    " Instagram LOCAL DEV MODE — OAuth & webhooks disabled",
  );
  app.log.warn(
    " Reason: INSTAGRAM_REDIRECT_URI is missing or not HTTPS",
  );
  app.log.warn(
    " Using INSTAGRAM_MARKER for all Graph API calls",
  );
  app.log.warn(
    " Bootstrap: POST /api/instagram/auth/dev/bootstrap { profileId }",
  );
  app.log.warn(
    " Status:   GET  /api/instagram/auth/status",
  );
  app.log.warn(
    "═══════════════════════════════════════════════════════════",
  );
} else {
  app.log.info({
    oauth: isOAuthEnabled(),
    webhooks: isWebhooksEnabled(),
  }, "Instagram integration mode");
}

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
