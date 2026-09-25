import type { FastifyInstance } from "fastify";
import { runScheduledContentSlot } from "./content-plan.service.js";
import { runStrategyAgent } from "../strategy/strategy.agent.js";
import {
  enqueueContentPlanSlot,
  enqueueStrategyRun,
} from "../../../infrastructure/queue/index.js";

export async function registerPlanRoutes(app: FastifyInstance) {
  /** Run one content plan slot now (sync) */
  app.post("/api/ai/plan/run-slot", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      postType?: "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "VIDEO";
      topicHint?: string;
      autoPublish?: boolean;
    };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const result = await runScheduledContentSlot({
        profileId: body.profileId,
        postType: body.postType,
        topicHint: body.topicHint,
        autoPublish: body.autoPublish,
      });
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "plan slot failed",
      });
    }
  });

  /** Enqueue plan slot (async) */
  app.post("/api/ai/plan/run-slot/async", async (request, reply) => {
    const body = request.body as {
      profileId?: string;
      postType?: string;
      topicHint?: string;
      autoPublish?: boolean;
    };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    const job = await enqueueContentPlanSlot({
      profileId: body.profileId,
      postType: body.postType,
      topicHint: body.topicHint,
      autoPublish: body.autoPublish,
    });

    return reply.code(202).send({ success: true, jobId: job.id });
  });

  /** Strategy agent: insights → update contentStrategy */
  app.post("/api/ai/strategy/run", async (request, reply) => {
    const body = request.body as { profileId?: string };

    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }

    try {
      const result = await runStrategyAgent(body.profileId);
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "strategy failed",
      });
    }
  });

  app.post("/api/ai/strategy/run/async", async (request, reply) => {
    const body = request.body as { profileId?: string };
    if (!body.profileId) {
      return reply.code(400).send({ error: "profileId is required" });
    }
    const job = await enqueueStrategyRun({ profileId: body.profileId });
    return reply.code(202).send({ success: true, jobId: job.id });
  });
}
