import type { FastifyInstance } from "fastify";
import { createInstagramCommentsService } from "./comments.service";

export async function registerInstagramCommentsRoutes(app: FastifyInstance) {
  const accessToken = process.env.INSTAGRAM_MARKER;

  if (!accessToken) {
    throw new Error("INSTAGRAM_TEST_ACCESS_TOKEN is not configured");
  }

  const commentsService = createInstagramCommentsService(accessToken);

  app.get("/api/instagram/media/:mediaId/comments", async (request) => {
    const { mediaId } = request.params as {
      mediaId: string;
    };

    return commentsService.listComments(mediaId);
  });

  app.get("/api/instagram/comments/:commentId/replies", async (request) => {
    const { commentId } = request.params as {
      commentId: string;
    };

    return commentsService.listReplies(commentId);
  });

  app.post("/api/instagram/comments/:commentId/reply", async (request) => {
    const { commentId } = request.params as {
      commentId: string;
    };

    const body = request.body as {
      message?: string;
    };

    if (!body.message) {
      return {
        error: "message is required",
      };
    }

    return commentsService.replyToComment(commentId, body.message);
  });

  app.delete("/api/instagram/comments/:commentId", async (request) => {
    const { commentId } = request.params as {
      commentId: string;
    };

    return commentsService.deleteComment(commentId);
  });
}
