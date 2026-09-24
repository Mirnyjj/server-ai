import type { FastifyInstance } from "fastify";
import { resolveAccessToken } from "../auth/token.resolver";
import { createInstagramContentService } from "./content.service";

export async function registerInstagramContentRoutes(app: FastifyInstance) {
  app.post("/api/instagram/content/image", async (request, reply) => {
    const body = request.body as {
      instagramUserId?: string;
      imageUrl?: string;
      caption?: string;
      altText?: string;
      isAiGenerated?: boolean;
    };

    if (!body.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    if (!body.imageUrl) {
      return reply.code(400).send({
        error: "imageUrl is required",
      });
    }

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: body.instagramUserId,
      });
      const contentService = createInstagramContentService(accessToken);

      return contentService.publishImage({
        instagramUserId: body.instagramUserId,
        imageUrl: body.imageUrl,
        caption: body.caption,
        altText: body.altText,
        isAiGenerated: body.isAiGenerated,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to publish image",
      });
    }
  });

  app.post("/api/instagram/content/reel", async (request, reply) => {
    const body = request.body as {
      instagramUserId?: string;
      videoUrl?: string;
      caption?: string;
      isAiGenerated?: boolean;
    };

    if (!body.instagramUserId || !body.videoUrl) {
      return reply.code(400).send({
        error: "instagramUserId and videoUrl are required",
      });
    }

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: body.instagramUserId,
      });
      const contentService = createInstagramContentService(accessToken);

      return contentService.publishReel({
        instagramUserId: body.instagramUserId,
        videoUrl: body.videoUrl,
        caption: body.caption,
        isAiGenerated: body.isAiGenerated,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to publish reel",
      });
    }
  });

  app.post("/api/instagram/content/carousel", async (request, reply) => {
    const body = request.body as {
      instagramUserId?: string;
      items?: Array<{
        imageUrl?: string;
        videoUrl?: string;
      }>;
      caption?: string;
      isAiGenerated?: boolean;
    };

    if (!body.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    if (!body.items?.length) {
      return reply.code(400).send({
        error: "items are required",
      });
    }

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: body.instagramUserId,
      });
      const contentService = createInstagramContentService(accessToken);

      return contentService.publishCarousel({
        instagramUserId: body.instagramUserId,
        items: body.items,
        caption: body.caption,
        isAiGenerated: body.isAiGenerated,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish carousel",
      });
    }
  });

  app.post("/api/instagram/content/story", async (request, reply) => {
    const body = request.body as {
      instagramUserId?: string;
      imageUrl?: string;
      videoUrl?: string;
      isAiGenerated?: boolean;
    };

    if (!body.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    if (!body.imageUrl && !body.videoUrl) {
      return reply.code(400).send({
        error: "imageUrl or videoUrl is required",
      });
    }

    if (body.imageUrl && body.videoUrl) {
      return reply.code(400).send({
        error: "Only one of imageUrl or videoUrl can be provided",
      });
    }

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: body.instagramUserId,
      });
      const contentService = createInstagramContentService(accessToken);

      return contentService.publishStory({
        instagramUserId: body.instagramUserId,
        imageUrl: body.imageUrl,
        videoUrl: body.videoUrl,
        isAiGenerated: body.isAiGenerated,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to publish story",
      });
    }
  });
}
