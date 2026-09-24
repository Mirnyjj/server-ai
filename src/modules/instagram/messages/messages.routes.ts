import type { FastifyInstance } from "fastify";
import { resolveAccessToken } from "../auth/token.resolver";
import { createInstagramMessagesService } from "./messages.service";

export async function registerInstagramMessagesRoutes(app: FastifyInstance) {
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

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: body.instagramUserId,
      });
      const messagesService = createInstagramMessagesService(accessToken);

      return messagesService.sendMessage(
        body.instagramUserId,
        body.recipientId,
        body.message,
      );
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to send message",
      });
    }
  });
}
