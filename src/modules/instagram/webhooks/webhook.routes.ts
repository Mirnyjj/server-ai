import type { FastifyInstance } from "fastify";
import { createInstagramWebhookService } from "./webhook.service";

export async function registerInstagramWebhookRoutes(app: FastifyInstance) {
  const accessToken = process.env.INSTAGRAM_MARKER;

  if (!accessToken) {
    throw new Error("INSTAGRAM_MARKER is not configured");
  }

  const webhookService = createInstagramWebhookService(accessToken);

  app.get("/api/instagram/webhook", async (request, reply) => {
    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };

    const mode = query["hub.mode"];
    const verifyToken = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (
      mode !== "subscribe" ||
      verifyToken !== process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
    ) {
      return reply.code(403).send({
        error: "Forbidden",
      });
    }

    return reply.type("text/plain").send(challenge);
  });

  app.post("/api/instagram/webhook", async (request, reply) => {
    await webhookService.handleEvent(request.body);

    return reply.code(200).send({
      received: true,
    });
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

    return webhookService.subscribeToWebhooks(query.instagramUserId);
  });
}
