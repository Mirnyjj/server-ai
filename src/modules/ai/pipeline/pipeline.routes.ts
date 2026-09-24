import type { FastifyInstance } from "fastify";
import { runContentPipeline } from "./content.pipeline";
import type { ContentScenario } from "../content/scenario.types";

export async function registerPipelineRoutes(app: FastifyInstance) {
  /**
   * Run full content pipeline:
   * Luna scenario → image/video generator → Post + MediaAsset (READY)
   */
  app.post("/api/ai/pipeline/run", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      postType?: ContentScenario["postType"];
      topicHint?: string;
      scenario?: ContentScenario;
    };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const result = await runContentPipeline({
        profileId: body.profileId,
        postType: body.postType,
        topicHint: body.topicHint,
        scenario: body.scenario,
      });

      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "pipeline failed",
      });
    }
  });
}
