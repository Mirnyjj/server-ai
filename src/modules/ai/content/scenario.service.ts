import { prisma } from "../../../../prisma/prisma.js";
import { getBrainLlm } from "../llm/provider.js";
import { createReferenceService } from "../references/reference.service.js";
import type { AnalyticsInsight, ContentScenario } from "./scenario.types.js";

/**
 * Luna writes content scenarios and analytics.
 * Does not generate images/videos.
 */
export function createScenarioService() {
  const llm = getBrainLlm();
  const references = createReferenceService();

  async function generateScenario(input: {
    profileId: string;
    postType?: ContentScenario["postType"];
    topicHint?: string;
  }): Promise<ContentScenario> {
    const profile = await prisma.aiProfile.findUnique({
      where: { id: input.profileId },
    });
    if (!profile) throw new Error(`Profile ${input.profileId} not found`);

    const consistency = await references.buildConsistencyPrompt(input.profileId);

    const result = await llm.completeJson<ContentScenario>({
      schemaName: "ContentScenario",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Create one Instagram content scenario for this AI persona",
            postType: input.postType ?? "PHOTO",
            topicHint: input.topicHint,
            persona: profile.persona,
            visualIdentity: profile.visualIdentity,
            writingStyle: profile.writingStyle,
            contentStrategy: profile.contentStrategy,
            characterConsistency: consistency,
            outputSchema: {
              title: "string",
              postType: "PHOTO|REEL|STORY|CAROUSEL|VIDEO",
              caption: "string",
              hashtags: ["string"],
              hook: "string",
              visualBrief: {
                prompt: "string — detailed generation prompt matching character refs",
                negativePrompt: "string",
                aspectRatio: "4:5|9:16|1:1",
                emphasizeReferences: ["FACE"],
                mood: "string",
                camera: "string",
              },
              reasoning: "string",
            },
          }),
        },
      ],
    });

    // Stub fallback shape
    if ((result.data as { _stub?: boolean })._stub) {
      return {
        title: "Stub scenario",
        postType: input.postType ?? "PHOTO",
        caption: "Coming soon from Luna ✨",
        visualBrief: {
          prompt: `Portrait of the character. ${consistency}`,
          aspectRatio: "4:5",
          emphasizeReferences: ["FACE"],
        },
        reasoning: "LUNA_API_KEY not configured",
      };
    }

    return result.data;
  }

  async function analyzePerformance(input: {
    profileId: string;
  }): Promise<AnalyticsInsight> {
    const posts = await prisma.post.findMany({
      where: { profileId: input.profileId, status: "PUBLISHED" },
      include: {
        metrics: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
    });

    const summary = posts.map((p) => ({
      type: p.type,
      caption: p.caption?.slice(0, 80),
      metrics: p.metrics[0]?.metrics ?? null,
      publishedAt: p.publishedAt,
    }));

    const profile = await prisma.aiProfile.findUnique({
      where: { id: input.profileId },
    });

    const result = await llm.completeJson<AnalyticsInsight>({
      schemaName: "AnalyticsInsight",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            task: "Analyze Instagram performance and recommend content strategy adjustments",
            contentStrategy: profile?.contentStrategy,
            recentPosts: summary,
            outputSchema: {
              insights: [{ topic: "string", metric: "string", change: 0, note: "string" }],
              recommendations: [
                { type: "string", value: "string", rationale: "string" },
              ],
            },
          }),
        },
      ],
    });

    if ((result.data as { _stub?: boolean })._stub) {
      return {
        insights: [],
        recommendations: [
          {
            type: "note",
            value: "Connect LUNA_API_KEY for real analytics",
          },
        ],
      };
    }

    return result.data;
  }

  return { generateScenario, analyzePerformance };
}
