import { prisma } from "../../../../prisma/prisma.js";
import { getBrainLlm } from "../llm/provider.js";
import type { AnalyticsInsight } from "../content/scenario.types.js";
import { createScenarioService } from "../content/scenario.service.js";

/**
 * Strategy Agent (TZ §29).
 * Analyzes metrics → updates contentStrategy only (never system Policy).
 */
export async function runStrategyAgent(profileId: string): Promise<{
  insight: AnalyticsInsight;
  contentStrategyUpdated: boolean;
  contentStrategy: unknown;
}> {
  const profile = await prisma.aiProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile) throw new Error(`Profile ${profileId} not found`);

  const scenarioService = createScenarioService();
  const insight = await scenarioService.analyzePerformance({ profileId });

  const llm = getBrainLlm();

  type StrategyPatch = {
    contentStrategy: Record<string, unknown>;
    summary: string;
  };

  const result = await llm.completeJson<StrategyPatch>({
    schemaName: "StrategyPatch",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task: "Update contentStrategy JSON for this AI Instagram persona based on insights. Do NOT change policies, safety rules, or autonomousMode.",
          currentContentStrategy: profile.contentStrategy,
          insights: insight,
          outputSchema: {
            contentStrategy: {
              preferredFormats: ["PHOTO", "REEL"],
              postingFrequencyPerWeek: 5,
              topics: ["string"],
              captionStyle: "string",
              bestTimesUtc: ["string"],
              notes: "string",
            },
            summary: "string",
          },
        }),
      },
    ],
  });

  let contentStrategy = profile.contentStrategy;
  let updated = false;

  if (
    !(result.data as { _stub?: boolean })._stub &&
    result.data.contentStrategy &&
    typeof result.data.contentStrategy === "object"
  ) {
    contentStrategy = {
      ...(typeof profile.contentStrategy === "object" &&
      profile.contentStrategy
        ? (profile.contentStrategy as object)
        : {}),
      ...result.data.contentStrategy,
      _lastStrategyRunAt: new Date().toISOString(),
      _lastStrategySummary: result.data.summary,
    };

    await prisma.aiProfile.update({
      where: { id: profileId },
      data: { contentStrategy: contentStrategy as object },
    });
    updated = true;
  }

  await prisma.agentAction.create({
    data: {
      profileId,
      action: "strategy.run",
      status: "SUCCESS",
      input: { insight } as object,
      output: { updated, summary: (result.data as StrategyPatch).summary } as object,
    },
  });

  // Store memory
  await prisma.agentMemory.create({
    data: {
      profileId,
      type: "STRATEGY",
      content: {
        insight,
        contentStrategy,
      } as object,
      importance: 0.8,
    },
  });

  return {
    insight,
    contentStrategyUpdated: updated,
    contentStrategy,
  };
}
