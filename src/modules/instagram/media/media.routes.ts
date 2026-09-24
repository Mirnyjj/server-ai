import type { FastifyInstance } from "fastify";
import { createInstagramMediaService } from "./media.service";

export async function registerInstagramMediaRoutes(app: FastifyInstance) {
  const accessToken = process.env.INSTAGRAM_MARKER;

  if (!accessToken) {
    throw new Error("INSTAGRAM_MARKER is not configured");
  }

  const mediaService = createInstagramMediaService(accessToken);

  app.get("/api/instagram/media", async (request, reply) => {
    const query = request.query as {
      instagramUserId?: string;
    };

    if (!query.instagramUserId) {
      return reply.code(400).send({
        error: "instagramUserId is required",
      });
    }

    return mediaService.listMedia(query.instagramUserId);
  });
}
