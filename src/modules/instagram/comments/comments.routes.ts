import type { FastifyInstance } from "fastify";
import {
  resolveAccessToken,
  resolveAccessTokenByProfileId,
} from "../auth/token.resolver.js";
import { createInstagramCommentsService } from "./comments.service.js";
import { enqueueCommentReconciliation } from "../../../infrastructure/queue.js";

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

  /** Reconcile comments for one post → DB (sync) */
  app.post("/api/instagram/comments/reconcile/post", async (request, reply) => {
    const body = request.body as {
      postId?: string;
      instagramMediaId?: string;
    };

    if (!body.postId && !body.instagramMediaId) {
      return reply.code(400).send({
        error: "postId or instagramMediaId is required",
      });
    }

    try {
      const accessToken = await resolveAccessToken();
      const service = createInstagramCommentsService(accessToken);
      const result = await service.reconcilePostComments({
        postId: body.postId,
        instagramMediaId: body.instagramMediaId,
      });

      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Comment reconciliation failed",
      });
    }
  });

  /** Reconcile comments for profile posts → DB (sync) */
  app.post("/api/instagram/comments/reconcile/profile", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      limit?: number;
    };

    if (!body.profileId) {
      return reply.code(400).send({
        error: "profileId is required",
      });
    }

    try {
      const accessToken = await resolveAccessTokenByProfileId(body.profileId);
      const service = createInstagramCommentsService(accessToken);
      const result = await service.reconcileProfileComments({
        profileId: body.profileId,
        limit: body.limit,
      });

      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Profile comment reconciliation failed",
      });
    }
  });

  /** Async reconciliation via BullMQ */
  app.post(
    "/api/instagram/comments/reconcile/profile/async",
    async (request, reply) => {
      const body = request.body as {
        profileId?: string;
        limit?: number;
      };

      if (!body.profileId) {
        return reply.code(400).send({
          error: "profileId is required",
        });
      }

      try {
        const job = await enqueueCommentReconciliation({
          profileId: body.profileId,
          limit: body.limit,
        });

        return reply.code(202).send({
          success: true,
          jobId: job.id,
          queue: "comment-reconcile",
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : "Failed to enqueue comment reconciliation",
        });
      }
    },
  );
}
