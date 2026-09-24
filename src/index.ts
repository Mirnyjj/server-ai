import { createApp } from "./app";
import {
  env,
  isInstagramDevMode,
  isOAuthEnabled,
  isTelegramEnabled,
  isWebhooksEnabled,
} from "./config/env";
import {
  startWorkers,
  stopWorkers,
  closeAllQueues,
} from "./infrastructure/queue";
import { closeRedisConnection } from "./infrastructure/redis";
import {
  startTelegramPolling,
  stopTelegramPolling,
} from "./modules/telegram/telegram.polling";

const app = await createApp();

const workers = startWorkers();

if (isInstagramDevMode()) {
  app.log.warn("═══════════════════════════════════════════════════════════");
  app.log.warn(" Instagram LOCAL DEV MODE — OAuth & webhooks disabled");
  app.log.warn(
    " Using INSTAGRAM_MARKER · bootstrap: POST /api/instagram/auth/dev/bootstrap",
  );
  app.log.warn("═══════════════════════════════════════════════════════════");
} else {
  app.log.info(
    { oauth: isOAuthEnabled(), webhooks: isWebhooksEnabled() },
    "Instagram integration mode",
  );
}

if (isTelegramEnabled()) {
  app.log.info("Telegram control plane: ENABLED");
} else {
  app.log.info("Telegram control plane: disabled (set TELEGRAM_BOT_TOKEN)");
}

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down…`);

  try {
    stopTelegramPolling();
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

  void startTelegramPolling();
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
