import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerInstagramAuthRoutes } from "./modules/instagram/auth/auth.routes.js";
import { registerInstagramCommentsRoutes } from "./modules/instagram/comments/comments.routes.js";
import { registerInstagramContentRoutes } from "./modules/instagram/content/content.routes.js";
import { registerInstagramMediaRoutes } from "./modules/instagram/media/media.routes.js";
import { registerInstagramMessagesRoutes } from "./modules/instagram/messages/messages.routes.js";
import { registerInstagramWebhookRoutes } from "./modules/instagram/webhooks/webhook.routes.js";
import { registerInstagramProfileRoutes } from "./modules/instagram/profile/profile.routes.js";
import { registerInstagramInsightsRoutes } from "./modules/instagram/insights/insights.routes.js";
import { registerAgentRoutes } from "./modules/agent/agent.routes.js";
import { registerTelegramRoutes } from "./modules/telegram/telegram.routes.js";
import { registerReferenceRoutes } from "./modules/ai/references/reference.routes.js";
import { registerAiContentRoutes } from "./modules/ai/content/content.routes.js";
import { registerPipelineRoutes } from "./modules/ai/pipeline/pipeline.routes.js";
import { registerStorageRoutes } from "./infrastructure/storage/storage.routes.js";
import { registerPlanRoutes } from "./modules/ai/plan/plan.routes.js";
import { registerMcpRoutes } from "./mcp/mcp.routes.js";
import { registerLandingRoutes } from "./modules/landing/landing.routes.js";

export async function createApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors);

  app.get("/health", async () => ({
    status: "ok",
  }));

  await registerLandingRoutes(app);

  await registerInstagramAuthRoutes(app);
  await registerInstagramCommentsRoutes(app);
  await registerInstagramContentRoutes(app);
  await registerInstagramMediaRoutes(app);
  await registerInstagramMessagesRoutes(app);
  await registerInstagramWebhookRoutes(app);
  await registerInstagramProfileRoutes(app);
  await registerInstagramInsightsRoutes(app);
  await registerAgentRoutes(app);
  await registerTelegramRoutes(app);
  await registerReferenceRoutes(app);
  await registerAiContentRoutes(app);
  await registerPipelineRoutes(app);
  await registerStorageRoutes(app);
  await registerPlanRoutes(app);
  await registerMcpRoutes(app);
  return app;
}
