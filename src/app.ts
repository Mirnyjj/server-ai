import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerInstagramAuthRoutes } from "./modules/instagram/auth/auth.routes";
import { registerInstagramCommentsRoutes } from "./modules/instagram/comments/comments.routes";
import { registerInstagramContentRoutes } from "./modules/instagram/content/content.routes";
import { registerInstagramMediaRoutes } from "./modules/instagram/media/media.routes";
import { registerInstagramMessagesRoutes } from "./modules/instagram/messages/messages.routes";
import { registerInstagramWebhookRoutes } from "./modules/instagram/webhooks/webhook.routes.ts";
import { registerInstagramProfileRoutes } from "./modules/instagram/profile/profile.routes.ts";

export async function createApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });
  await registerInstagramAuthRoutes(app);
  await registerInstagramCommentsRoutes(app);
  await registerInstagramContentRoutes(app);
  await registerInstagramMediaRoutes(app);
  await registerInstagramMessagesRoutes(app);
  await registerInstagramWebhookRoutes(app);
  await registerInstagramProfileRoutes(app);

  return app;
}
