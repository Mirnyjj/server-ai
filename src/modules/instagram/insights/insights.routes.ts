import type { FastifyInstance } from "fastify";
import {
  resolveAccessToken,
  resolveAccessTokenByProfileId,
} from "../auth/token.resolver";
import { createInstagramInsightsService } from "./insights.service";
import { enqueueCollectInsights } from "../../../infrastructure/queue";

export async function registerInstagramInsightsRoutes(app: FastifyInstance) {
  /** Raw media insights from Graph API (no DB write) */
  app.get("/api/instagram/insights/media/:instagramMediaId", async (request, reply) => {
    const { instagramMediaId } = request.params as { instagramMediaId: string };
    const query = request.query as { mediaType?: string };

    try {
      const accessToken = await resolveAccessToken();
      const service = createInstagramInsightsService(accessToken);
      const result = await service.fetchMediaInsights(
        instagramMediaId,
        query.mediaType,
      );
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch media insights",
      });
    }
  });

  /** Collect + persist insights for one Post */
  app.post("/api/instagram/insights/posts/:postId/collect", async (request, reply) => {
    const { postId } = request.params as { postId: string };

    try {
      const accessToken = await resolveAccessToken();
      const service = createInstagramInsightsService(accessToken);
      const result = await service.collectPostInsights(postId);
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to collect post insights",
      });
    }
  });

  /** Stored metric history for a post */
  app.get("/api/instagram/insights/posts/:postId", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const query = request.query as { limit?: string };
    const limit = query.limit ? Number(query.limit) : 10;

    try {
      const accessToken = await resolveAccessToken();
      const service = createInstagramInsightsService(accessToken);
      const rows = await service.getStoredPostMetrics(postId, limit);
      return reply.send({ success: true, postId, metrics: rows });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load stored metrics",
      });
    }
  });

  /** Collect insights for all published posts of a profile (sync) */
  app.post("/api/instagram/insights/profile/collect", async (request, reply) => {
    const body = request.body as { profileId?: string };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const accessToken = await resolveAccessTokenByProfileId(body.profileId);
      const service = createInstagramInsightsService(accessToken);
      const result = await service.collectProfilePostInsights(body.profileId);
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to collect profile insights",
      });
    }
  });

  /** Async collect via BullMQ */
  app.post("/api/instagram/insights/profile/collect/async", async (request, reply) => {
    const body = request.body as { profileId?: string };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const job = await enqueueCollectInsights({ profileId: body.profileId });
      return reply.code(202).send({
        success: true,
        jobId: job.id,
        queue: "insights",
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to enqueue insights collection",
      });
    }
  });

  /** Account-level insights from Graph API */
  app.get("/api/instagram/insights/account", async (request, reply) => {
    const query = request.query as {
      instagramUserId?: string;
      period?: string;
    };

    if (!query.instagramUserId) {
      return reply.code(400).send({ error: "instagramUserId is required" });
    }

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: query.instagramUserId,
      });
      const service = createInstagramInsightsService(accessToken);
      const result = await service.fetchAccountInsights(
        query.instagramUserId,
        { period: query.period },
      );
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch account insights",
      });
    }
  });
}
