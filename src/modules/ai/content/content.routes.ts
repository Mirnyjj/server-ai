import type { FastifyInstance } from "fastify";
import { createScenarioService } from "./scenario.service";

export async function registerAiContentRoutes(app: FastifyInstance) {
  const service = createScenarioService();

  /** Luna: generate content scenario (caption + visual brief) */
  app.post("/api/ai/scenarios/generate", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      postType?: "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "VIDEO";
      topicHint?: string;
    };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const scenario = await service.generateScenario({
        profileId: body.profileId,
        postType: body.postType,
        topicHint: body.topicHint,
      });
      return reply.send({ success: true, scenario });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "scenario failed",
      });
    }
  });

  /** Luna: performance analytics + recommendations */
  app.post("/api/ai/analytics/run", async (request, reply) => {
    const body = request.body as { profileId?: string };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const insight = await service.analyzePerformance({
        profileId: body.profileId,
      });
      return reply.send({ success: true, insight });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "analytics failed",
      });
    }
  });
}
