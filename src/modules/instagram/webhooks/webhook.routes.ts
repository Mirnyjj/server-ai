import type { FastifyInstance } from "fastify";
import {
  env,
  isInstagramDevMode,
  isWebhooksEnabled,
} from "../../../config/env.js";
import { createInstagramWebhookService } from "./webhook.service.js";

export async function registerInstagramWebhookRoutes(app: FastifyInstance) {
  const webhookService = createInstagramWebhookService(env.INSTAGRAM_MARKER);

  app.get("/api/instagram/webhook", async (request, reply) => {
    if (!isWebhooksEnabled()) {
      return reply.code(503).send({
        error: "webhooks_disabled",
        devMode: isInstagramDevMode(),
        message: isInstagramDevMode()
          ? "Webhooks require a public HTTPS endpoint. Local dev mode is active (no HTTPS INSTAGRAM_REDIRECT_URI). Use Graph API polling / sync endpoints instead."
          : "INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured",
      });
    }

    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };

    const mode = query["hub.mode"];
    const verifyToken = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const expectedToken = env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN!;

    if (mode === "subscribe" && verifyToken === expectedToken && challenge) {
      return reply.type("text/plain").code(200).send(challenge);
    }

    return reply.code(403).send({ error: "Forbidden" });
  });

  app.post("/api/instagram/webhook", async (request, reply) => {
    // In local dev Meta cannot reach localhost — accept body for manual testing
    // but skip strict signature when webhooks are formally disabled.
    if (!isWebhooksEnabled()) {
      request.log.info(
        { body: request.body },
        "Webhook POST received in dev mode (webhooks disabled) — acknowledged, not processed",
      );

      return reply.code(200).send({
        received: true,
        processed: false,
        devMode: true,
        message:
          "Webhooks disabled in local dev. Event logged but not enqueued. Use media/comments sync APIs.",
      });
    }

    const signature = request.headers["x-hub-signature-256"] as
      | string
      | undefined;

    const rawBody =
      typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body ?? {});

    try {
      const result = await webhookService.handleEvent(request.body, {
        rawBody,
        signature,
      });

      return reply.code(200).send({
        received: true,
        enqueued: result.enqueued,
      });
    } catch (error) {
      request.log.error(error);

      if (
        error instanceof Error &&
        error.message.includes("Invalid Meta webhook signature")
      ) {
        return reply.code(403).send({ error: "Invalid signature" });
      }

      return reply.code(200).send({
        received: true,
        error: error instanceof Error ? error.message : "processing failed",
      });
    }
  });

  app.post("/api/instagram/webhooks/subscribe", async (request, reply) => {
    if (!isWebhooksEnabled()) {
      return reply.code(503).send({
        error: "webhooks_disabled",
        devMode: isInstagramDevMode(),
        message:
          "Cannot subscribe to Meta webhooks without public HTTPS + VERIFY_TOKEN",
      });
    }

    const query = request.query as {
      instagramUserId?: string;
    };

    if (!query.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    try {
      const result = await webhookService.subscribeToWebhooks(
        query.instagramUserId,
      );
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to subscribe to webhooks",
      });
    }
  });
}
