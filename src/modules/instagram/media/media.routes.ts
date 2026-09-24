import type { FastifyInstance } from "fastify";
import { resolveAccessToken, resolveAccessTokenByProfileId } from "../auth/token.resolver";
import { createInstagramMediaService } from "./media.service";

export async function registerInstagramMediaRoutes(app: FastifyInstance) {
  app.get("/api/instagram/media", async (request, reply) => {
    const query = request.query as {
      instagramUserId?: string;
      after?: string;
      limit?: string;
    };

    if (!query.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    const limit = query.limit ? Number(query.limit) : undefined;

    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 100)
    ) {
      return reply.code(400).send({
        error: "limit must be an integer between 1 and 100",
      });
    }

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: query.instagramUserId,
      });
      const mediaService = createInstagramMediaService(accessToken);

      return mediaService.listMedia(query.instagramUserId, {
        after: query.after,
        limit,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to list media",
      });
    }
  });

  app.post("/api/instagram/media/sync", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
    };

    if (!body.profileId) {
      return reply.code(400).send({
        error: "profileId is required",
      });
    }

    try {
      const accessToken = await resolveAccessTokenByProfileId(body.profileId);
      const mediaService = createInstagramMediaService(accessToken);
      const result = await mediaService.syncPosts(body.profileId);

      return reply.send({
        success: true,
        account: result.account,
        imported: result.imported,
        createdPosts: result.createdPosts,
        updatedPosts: result.updatedPosts,
        createdMediaAssets: result.createdMediaAssets,
        updatedMediaAssets: result.updatedMediaAssets,
        createdPostMedia: result.createdPostMedia,
        updatedPostMedia: result.updatedPostMedia,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Instagram media sync failed",
      });
    }
  });

  app.get("/api/instagram/media/:mediaId", async (request, reply) => {
    const { mediaId } = request.params as {
      mediaId: string;
    };

    try {
      // Token resolution without account context — falls back to MARKER
      const accessToken = await resolveAccessToken();
      const mediaService = createInstagramMediaService(accessToken);
      const media = await mediaService.getMedia(mediaId);

      return reply.send({
        success: true,
        media,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get Instagram media",
      });
    }
  });
}
