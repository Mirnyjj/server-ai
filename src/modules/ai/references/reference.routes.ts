import type { FastifyInstance } from "fastify";
import { createReferenceService } from "./reference.service";

export async function registerReferenceRoutes(app: FastifyInstance) {
  const service = createReferenceService();

  /** List character references for a profile */
  app.get("/api/ai/profiles/:profileId/references", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };
    try {
      const refs = await service.listReferences(profileId);
      return reply.send({ success: true, references: refs });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "list failed",
      });
    }
  });

  /**
   * Add reference photo + description.
   * Body: { url, type, description, tags?, priority?, notes?, locks? }
   */
  app.post("/api/ai/profiles/:profileId/references", async (request, reply) => {
    const { profileId } = request.params as { profileId: string };
    const body = request.body as {
      url?: string;
      type?: string;
      description?: string;
      tags?: string[];
      priority?: number;
      notes?: string;
      locks?: string[];
      mimeType?: string;
    };

    if (!body.url || !body.type || !body.description) {
      return reply.code(400).send({
        error: "url, type, and description are required",
        example: {
          url: "https://cdn.example.com/face1.jpg",
          type: "FACE",
          description:
            "Young woman, 25, blonde wavy hair, blue eyes, light freckles, soft smile",
          priority: 10,
          tags: ["primary", "front"],
        },
      });
    }

    try {
      const ref = await service.addReference({
        profileId,
        url: body.url,
        type: body.type,
        description: body.description,
        tags: body.tags,
        priority: body.priority,
        notes: body.notes,
        locks: body.locks as never,
        mimeType: body.mimeType,
      });
      return reply.code(201).send({ success: true, reference: ref });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "create failed",
      });
    }
  });

  /** Reference pack ready for generators */
  app.get(
    "/api/ai/profiles/:profileId/references/pack",
    async (request, reply) => {
      const { profileId } = request.params as { profileId: string };
      try {
        const pack = await service.getReferencePack(profileId);
        const consistencyPrompt =
          await service.buildConsistencyPrompt(profileId);
        return reply.send({ success: true, pack, consistencyPrompt });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          error: error instanceof Error ? error.message : "pack failed",
        });
      }
    },
  );

  app.delete("/api/ai/references/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await service.deleteReference(id);
      return reply.send({ success: true, ...result });
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({
        error: error instanceof Error ? error.message : "delete failed",
      });
    }
  });
}
