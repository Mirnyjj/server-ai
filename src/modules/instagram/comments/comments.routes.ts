import type { FastifyInstance } from "fastify";
import { resolveAccessToken } from "../auth/token.resolver";
import { createInstagramCommentsService } from "./comments.service";

export async function registerInstagramCommentsRoutes(app: FastifyInstance) {
  app.get("/api/instagram/media/:mediaId/comments", async (request, reply) => {
    const { mediaId } = request.params as {
      mediaId: string;
    };

    const query = request.query as {
      after?: string;
      limit?: string;
    };

    try {
      const accessToken = await resolveAccessToken();
      const commentsService = createInstagramCommentsService(accessToken);

      return commentsService.listComments(mediaId, {
        after: query.after,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to list comments",
      });
    }
  });

  app.get("/api/instagram/comments/:commentId/replies", async (request, reply) => {
    const { commentId } = request.params as {
      commentId: string;
    };

    try {
      const accessToken = await resolveAccessToken();
      const commentsService = createInstagramCommentsService(accessToken);

      return commentsService.listReplies(commentId);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to list replies",
      });
    }
  });

  app.post("/api/instagram/comments/:commentId/reply", async (request, reply) => {
    const { commentId } = request.params as {
      commentId: string;
    };

    const body = request.body as {
      message?: string;
    };

    if (!body.message) {
      return reply.code(400).send({
        error: "message is required",
      });
    }

    try {
      const accessToken = await resolveAccessToken();
      const commentsService = createInstagramCommentsService(accessToken);

      return commentsService.replyToComment(commentId, body.message);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to reply to comment",
      });
    }
  });

  app.delete("/api/instagram/comments/:commentId", async (request, reply) => {
    const { commentId } = request.params as {
      commentId: string;
    };

    try {
      const accessToken = await resolveAccessToken();
      const commentsService = createInstagramCommentsService(accessToken);

      return commentsService.deleteComment(commentId);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete comment",
      });
    }
  });
}
