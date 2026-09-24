import type { FastifyInstance } from "fastify";
import { createInstagramContentService } from "./content.service";

export async function registerInstagramContentRoutes(app: FastifyInstance) {
  const accessToken = process.env.INSTAGRAM_MARKER;

  if (!accessToken) {
    throw new Error("INSTAGRAM_MARKER is not configured");
  }

  const contentService = createInstagramContentService(accessToken);

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

    return contentService.publishImage({
      instagramUserId: body.instagramUserId,
      imageUrl: body.imageUrl,
      caption: body.caption,
      altText: body.altText,
      isAiGenerated: body.isAiGenerated,
    });
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

    return contentService.publishReel({
      instagramUserId: body.instagramUserId,
      videoUrl: body.videoUrl,
      caption: body.caption,
      isAiGenerated: body.isAiGenerated,
    });
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

    return contentService.publishCarousel({
      instagramUserId: body.instagramUserId,
      items: body.items,
      caption: body.caption,
      isAiGenerated: body.isAiGenerated,
    });
  });
  app.post("/api/instagram/content/story", async (request, reply) => {
    const body = request.body as {
      instagramUserId?: string;
      imageUrl?: string;
      videoUrl?: string;
      isAiGenerated?: boolean;
    };

    console.log("STORY BODY:", body);
    console.log("instagramUserId:", body.instagramUserId);
    console.log("imageUrl:", body.imageUrl);
    console.log("videoUrl:", body.videoUrl);

    if (!body.instagramUserId) {
      console.log("FAILED: instagramUserId");

      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    if (!body.imageUrl && !body.videoUrl) {
      console.log("FAILED: imageUrl/videoUrl");

      return reply.code(400).send({
        error: "imageUrl or videoUrl is required",
      });
    }

    if (body.imageUrl && body.videoUrl) {
      console.log("FAILED: both imageUrl and videoUrl");

      return reply.code(400).send({
        error: "Only one of imageUrl or videoUrl can be provided",
      });
    }

    console.log("BODY:", request.body);
    console.log("BODY TYPE:", typeof request.body);
    console.log("BODY IS STRING:", typeof request.body === "string");

    return contentService.publishStory({
      instagramUserId: body.instagramUserId,
      imageUrl: body.imageUrl,
      videoUrl: body.videoUrl,
      isAiGenerated: body.isAiGenerated,
    });
  });
}
