import type { FastifyInstance } from "fastify";
import { processComment } from "./comment.agent.js";
import { processDirectMessage } from "./message.agent.js";
import { PolicyEngine } from "./policy/policy.engine.js";

export async function registerAgentRoutes(app: FastifyInstance) {
  /** Inspect effective policy for a profile */
  app.get("/api/agent/policy/:profileId", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };

    try {
      const policy = await PolicyEngine.forProfile(profileId);
      return reply.send({
        success: true,
        profileId,
        flags: policy.getFlags(),
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to load policy",
      });
    }
  });

  /** Run Comment Agent for one comment (manual / queue trigger) */
  app.post("/api/agent/comments/:commentId/process", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };

    try {
      const result = await processComment(commentId);
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Comment agent failed",
      });
    }
  });

  /** Run DM Agent for one inbound message */
  app.post("/api/agent/messages/:messageId/process", async (request, reply) => {
    const { messageId } = request.params as { messageId: string };

    try {
      const result = await processDirectMessage(messageId);
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "DM agent failed",
      });
    }
  });
}
