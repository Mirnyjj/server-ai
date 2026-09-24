import type { FastifyInstance } from "fastify";
import { env } from "../../../config/env";
import { createInstagramWebhookService } from "./webhook.service";

export async function registerInstagramWebhookRoutes(app: FastifyInstance) {
  const webhookService = createInstagramWebhookService(env.INSTAGRAM_MARKER);

  app.get("/api/instagram/webhook", async (request, reply) => {
    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };

    const mode = query["hub.mode"];
    const verifyToken = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const expectedToken = env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

    if (!expectedToken) {
      request.log.error(
        "INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured — cannot verify webhook",
      );
      return reply
        .code(500)
        .send({ error: "Webhook verify token not configured" });
    }

    if (mode === "subscribe" && verifyToken === expectedToken && challenge) {
      return reply.type("text/plain").code(200).send(challenge);
    }

    return reply.code(403).send({ error: "Forbidden" });
  });

  app.post("/api/instagram/webhook", async (request, reply) => {
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

      // Acknowledge to Meta to avoid retry storms; event may still be lost
      return reply.code(200).send({
        received: true,
        error: error instanceof Error ? error.message : "processing failed",
      });
    }
  });

  app.post("/api/instagram/webhooks/subscribe", async (request, reply) => {
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
