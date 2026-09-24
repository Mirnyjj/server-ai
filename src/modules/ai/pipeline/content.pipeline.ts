import { prisma } from "../../../../prisma/prisma";
import { PolicyEngine } from "../../agent/policy/policy.engine";
import { getImageGenerator, getVideoGenerator } from "../generators";
import type { CharacterReferenceInput } from "../generators/types";
import { createScenarioService } from "../content/scenario.service";
import type { ContentScenario } from "../content/scenario.types";
import { createReferenceService } from "../references/reference.service";

export type PipelineResult = {
  postId: string;
  status: string;
  scenario: ContentScenario;
  mediaAssets: Array<{ id: string; url: string; type: string }>;
  publishReady: boolean;
  note?: string;
};

/**
 * Full generation pipeline (without Instagram publish):
 *
 * 1. Policy: publishContent allowed?
 * 2. Luna → ContentScenario
 * 3. Reference pack
 * 4. ImageGenerator | VideoGenerator
 * 5. MediaAsset + Post (status READY or GENERATING)
 *
 * Publish is a separate step (content module / queue) once URL is public.
 */
export async function runContentPipeline(input: {
  profileId: string;
  postType?: ContentScenario["postType"];
  topicHint?: string;
  /** If set, skip Luna and use this scenario */
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

  const postType = scenario.postType;
  const isVideo = postType === "REEL" || postType === "VIDEO";

  // Create Post in GENERATING
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

  const mediaAssets: Array<{ id: string; url: string; type: string }> = [];

  try {
    if (isVideo) {
      const videoGen = getVideoGenerator();
      const result = await videoGen.generate({
        profileId: input.profileId,
        prompt: scenario.visualBrief.prompt,
        aspectRatio:
          (scenario.visualBrief.aspectRatio as "9:16" | "16:9" | "1:1") ??
          "9:16",
        references,
        visualIdentity: profile.visualIdentity,
        durationSec: scenario.shots?.[0]?.durationSec ?? 10,
      });

      const asset = await prisma.mediaAsset.create({
        data: {
          profileId: input.profileId,
          type: "VIDEO",
          status: "ACTIVE",
          url: result.url,
          storageKey: result.storageKey,
          mimeType: result.mimeType ?? "video/mp4",
          width: result.width,
          height: result.height,
          durationMs: result.durationMs,
          metadata: {
            provider: result.provider,
            model: result.model,
            prompt: scenario.visualBrief.prompt,
          },
        },
      });

      await prisma.postMedia.create({
        data: {
          postId: post.id,
          mediaAssetId: asset.id,
          type: "VIDEO",
          sortOrder: 0,
        },
      });

      mediaAssets.push({ id: asset.id, url: asset.url, type: "VIDEO" });
    } else if (postType === "CAROUSEL" && scenario.slides?.length) {
      const imageGen = getImageGenerator();
      let order = 0;
      for (const slide of scenario.slides.slice(0, 10)) {
        const result = await imageGen.generate({
          profileId: input.profileId,
          prompt: slide.visualBrief.prompt,
          negativePrompt: slide.visualBrief.negativePrompt,
          aspectRatio: slide.visualBrief.aspectRatio ?? "1:1",
          references,
          visualIdentity: profile.visualIdentity,
        });

        const asset = await prisma.mediaAsset.create({
          data: {
            profileId: input.profileId,
            type: "IMAGE",
            status: "ACTIVE",
            url: result.url,
            storageKey: result.storageKey,
            mimeType: result.mimeType ?? "image/jpeg",
            width: result.width,
            height: result.height,
            metadata: {
              provider: result.provider,
              model: result.model,
              prompt: slide.visualBrief.prompt,
            },
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

        mediaAssets.push({ id: asset.id, url: asset.url, type: "IMAGE" });
      }
    } else {
      // PHOTO or STORY image
      const imageGen = getImageGenerator();
      const result = await imageGen.generate({
        profileId: input.profileId,
        prompt: scenario.visualBrief.prompt,
        negativePrompt: scenario.visualBrief.negativePrompt,
        aspectRatio: scenario.visualBrief.aspectRatio ?? "4:5",
        references,
        visualIdentity: profile.visualIdentity,
      });

      const asset = await prisma.mediaAsset.create({
        data: {
          profileId: input.profileId,
          type: "IMAGE",
          status: "ACTIVE",
          url: result.url,
          storageKey: result.storageKey,
          mimeType: result.mimeType ?? "image/jpeg",
          width: result.width,
          height: result.height,
          metadata: {
            provider: result.provider,
            model: result.model,
            prompt: scenario.visualBrief.prompt,
          },
        },
      });

      await prisma.postMedia.create({
        data: {
          postId: post.id,
          mediaAssetId: asset.id,
          type: "IMAGE",
          sortOrder: 0,
        },
      });

      mediaAssets.push({ id: asset.id, url: asset.url, type: "IMAGE" });
    }

    const isStubUrl = mediaAssets.some((m) =>
      m.url.includes("placeholder.local"),
    );

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: isStubUrl ? "READY" : "READY",
      },
    });

    await prisma.agentAction.create({
      data: {
        profileId: input.profileId,
        action: "content.pipeline",
        status: "SUCCESS",
        input: { postType, topicHint: input.topicHint } as object,
        output: { postId: post.id, mediaCount: mediaAssets.length } as object,
      },
    });

    return {
      postId: post.id,
      status: "READY",
      scenario,
      mediaAssets,
      publishReady: !isStubUrl,
      note: isStubUrl
        ? "Media URLs are stubs — wire IMAGE/VIDEO generator + Object Storage before Instagram publish"
        : "Media ready — call publish endpoints with asset URLs",
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
