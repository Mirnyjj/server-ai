import type { FastifyInstance } from "fastify";
import { runContentPipeline } from "./content.pipeline.js";
import { enqueuePublishReadyPost } from "./publish-from-post.js";
import type { ContentScenario } from "../content/scenario.types.js";

export async function registerPipelineRoutes(app: FastifyInstance) {
  /**
   * Luna scenario → generate → Object Storage → Post READY
   * autoPublish=true → enqueue Instagram publish when URLs are public HTTPS
   */
  app.post("/api/ai/pipeline/run", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      postType?: ContentScenario["postType"];
      topicHint?: string;
      scenario?: ContentScenario;
      autoPublish?: boolean;
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

      let publishJob: { jobId?: string; mediaType?: string } | null = null;

      if (body.autoPublish && result.publishReady) {
        publishJob = await enqueuePublishReadyPost(result.postId);
      } else if (body.autoPublish && !result.publishReady) {
        return reply.send({
          success: true,
          ...result,
          publishJob: null,
          note:
            result.note +
            " autoPublish skipped — media URLs not public HTTPS",
        });
      }

      return reply.send({
        success: true,
        ...result,
        publishJob,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "pipeline failed",
      });
    }
  });

  /** Publish an existing READY post to Instagram via queue */
  app.post("/api/ai/pipeline/posts/:postId/publish", async (request, reply) => {
    const { postId } = request.params as { postId: string };

    try {
      const publishJob = await enqueuePublishReadyPost(postId);
      return reply.code(202).send({
        success: true,
        postId,
        ...publishJob,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "publish enqueue failed",
      });
    }
  });
}
