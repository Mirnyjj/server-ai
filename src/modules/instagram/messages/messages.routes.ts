import type { FastifyInstance } from "fastify";
import { createInstagramMessagesService } from "./messages.service";

export async function registerInstagramMessagesRoutes(app: FastifyInstance) {
  const accessToken = process.env.INSTAGRAM_MARKER;

  if (!accessToken) {
    throw new Error("INSTAGRAM_MARKER is not configured");
  }

  const messagesService = createInstagramMessagesService(accessToken);

  app.post("/api/instagram/messages/send", async (request, reply) => {
    const body = request.body as {
      instagramUserId?: string;
      recipientId?: string;
      message?: string;
    };

    if (!body.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    if (!body.recipientId) {
      return reply.code(400).send({
        error: "recipientId is required",
      });
    }

    if (!body.message) {
      return reply.code(400).send({
        error: "message is required",
      });
    }

    return messagesService.sendMessage(
      body.instagramUserId,
      body.recipientId,
      body.message,
    );
  });
}
