import { prisma } from "../../../../prisma/prisma.js";
import { PolicyEngine } from "../../agent/policy/policy.engine.js";
import { createStorageService } from "../../../infrastructure/storage/storage.service.js";
import { getImageGenerator, getVideoGenerator } from "../generators/index.js";
import type { CharacterReferenceInput } from "../generators/types.js";
import { createScenarioService } from "../content/scenario.service.js";
import type { ContentScenario } from "../content/scenario.types.js";
import { createReferenceService } from "../references/reference.service.js";

export type PipelineResult = {
  postId: string;
  status: string;
  scenario: ContentScenario;
  mediaAssets: Array<{
    id: string;
    url: string;
    type: string;
    storageKey?: string | null;
  }>;
  publishReady: boolean;
  note?: string;
};

function isPublicHttps(url: string): boolean {
  return url.startsWith("https://") && !url.includes("placeholder.local");
}

/**
 * Pipeline:
 * Policy → Luna scenario → refs → Image/Video gen → Object Storage → Post READY
 */
export async function runContentPipeline(input: {
  profileId: string;
  postType?: ContentScenario["postType"];
  topicHint?: string;
  scenario?: ContentScenario;
}): Promise<PipelineResult> {
  const policy = await PolicyEngine.forProfile(input.profileId);
  const canPublish = policy.can("publishContent");
  if (!canPublish.allowed) {
    throw new Error(`Policy blocked publishContent: ${canPublish.reason}`);
  }

  const profile = await prisma.aiProfile.findUnique({
    where: { id: input.profileId },
    include: {
      instagramAccounts: {
        where: { status: "ACTIVE" },
        take: 1,
      },
    },
  });

  if (!profile) {
    throw new Error(`Profile ${input.profileId} not found`);
  }

  const account = profile.instagramAccounts[0];
  if (!account) {
    throw new Error(
      `No ACTIVE InstagramAccount for profile ${input.profileId}. Bootstrap or OAuth first.`,
    );
  }

  const scenarioService = createScenarioService();
  const scenario =
    input.scenario ??
    (await scenarioService.generateScenario({
      profileId: input.profileId,
      postType: input.postType,
      topicHint: input.topicHint,
    }));

  const refService = createReferenceService();
  const pack = await refService.getReferencePack(input.profileId);
  const references: CharacterReferenceInput[] = pack.map((r) => ({
    type: r.type,
    url: r.url,
    description: r.description,
    priority: r.priority,
  }));

  const storageService = createStorageService();
  const postType = scenario.postType;
  const isVideo = postType === "REEL" || postType === "VIDEO";

  const post = await prisma.post.create({
    data: {
      profileId: input.profileId,
      accountId: account.id,
      type: postType,
      status: "GENERATING",
      caption: scenario.caption,
      isAiGenerated: true,
      generation: scenario as object,
    },
  });

  const mediaAssets: PipelineResult["mediaAssets"] = [];

  try {
    if (isVideo) {
      const videoGen = getVideoGenerator();
      const gen = await videoGen.generate({
        profileId: input.profileId,
        prompt: scenario.visualBrief.prompt,
        aspectRatio:
          (scenario.visualBrief.aspectRatio as "9:16" | "16:9" | "1:1") ??
          "9:16",
        references,
        visualIdentity: profile.visualIdentity,
        durationSec: scenario.shots?.[0]?.durationSec ?? 10,
      });

      const { asset } = await storageService.ingestUrl({
        profileId: input.profileId,
        sourceUrl: gen.url,
        mediaType: "VIDEO",
        kind: "generated",
        postId: post.id,
        contentType: gen.mimeType,
        metadata: {
          provider: gen.provider,
          model: gen.model,
          prompt: scenario.visualBrief.prompt,
        },
      });

      // Update dimensions if known
      if (gen.width || gen.height || gen.durationMs) {
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            width: gen.width,
            height: gen.height,
            durationMs: gen.durationMs,
          },
        });
      }

      await prisma.postMedia.create({
        data: {
          postId: post.id,
          mediaAssetId: asset.id,
          type: "VIDEO",
          sortOrder: 0,
        },
      });

      mediaAssets.push({
        id: asset.id,
        url: asset.url,
        type: "VIDEO",
        storageKey: asset.storageKey,
      });
    } else if (postType === "CAROUSEL" && scenario.slides?.length) {
      const imageGen = getImageGenerator();
      let order = 0;
      for (const slide of scenario.slides.slice(0, 10)) {
        const gen = await imageGen.generate({
          profileId: input.profileId,
          prompt: slide.visualBrief.prompt,
          negativePrompt: slide.visualBrief.negativePrompt,
          aspectRatio: slide.visualBrief.aspectRatio ?? "1:1",
          references,
          visualIdentity: profile.visualIdentity,
        });

        const { asset } = await storageService.ingestUrl({
          profileId: input.profileId,
          sourceUrl: gen.url,
          mediaType: "IMAGE",
          kind: "generated",
          postId: post.id,
          contentType: gen.mimeType,
          metadata: {
            provider: gen.provider,
            model: gen.model,
            prompt: slide.visualBrief.prompt,
          },
        });

        await prisma.postMedia.create({
          data: {
            postId: post.id,
            mediaAssetId: asset.id,
            type: "IMAGE",
            sortOrder: order++,
          },
        });

        mediaAssets.push({
          id: asset.id,
          url: asset.url,
          type: "IMAGE",
          storageKey: asset.storageKey,
        });
      }
    } else {
      const imageGen = getImageGenerator();
      const gen = await imageGen.generate({
        profileId: input.profileId,
        prompt: scenario.visualBrief.prompt,
        negativePrompt: scenario.visualBrief.negativePrompt,
        aspectRatio: scenario.visualBrief.aspectRatio ?? "4:5",
        references,
        visualIdentity: profile.visualIdentity,
      });

      const { asset } = await storageService.ingestUrl({
        profileId: input.profileId,
        sourceUrl: gen.url,
        mediaType: "IMAGE",
        kind: "generated",
        postId: post.id,
        contentType: gen.mimeType,
        metadata: {
          provider: gen.provider,
          model: gen.model,
          prompt: scenario.visualBrief.prompt,
        },
      });

      if (gen.width || gen.height) {
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { width: gen.width, height: gen.height },
        });
      }

      await prisma.postMedia.create({
        data: {
          postId: post.id,
          mediaAssetId: asset.id,
          type: "IMAGE",
          sortOrder: 0,
        },
      });

      mediaAssets.push({
        id: asset.id,
        url: asset.url,
        type: "IMAGE",
        storageKey: asset.storageKey,
      });
    }

    const publishReady = mediaAssets.every((m) => isPublicHttps(m.url));

    await prisma.post.update({
      where: { id: post.id },
      data: { status: "READY" },
    });

    await prisma.agentAction.create({
      data: {
        profileId: input.profileId,
        action: "content.pipeline",
        status: "SUCCESS",
        input: { postType, topicHint: input.topicHint } as object,
        output: {
          postId: post.id,
          mediaCount: mediaAssets.length,
          publishReady,
        } as object,
      },
    });

    return {
      postId: post.id,
      status: "READY",
      scenario,
      mediaAssets,
      publishReady,
      note: publishReady
        ? "Media on Object Storage with HTTPS — ready for Instagram publish"
        : "URLs are not public HTTPS (stub generator or local without tunnel). Meta publish will fail until fixed.",
    };
  } catch (error) {
    await prisma.post.update({
      where: { id: post.id },
      data: { status: "FAILED" },
    });

    await prisma.agentAction.create({
      data: {
        profileId: input.profileId,
        action: "content.pipeline",
        status: "FAILED",
        error: error instanceof Error ? error.message : "pipeline failed",
        input: { postId: post.id } as object,
      },
    });

    throw error;
  }
}
