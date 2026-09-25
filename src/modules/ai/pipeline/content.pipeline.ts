import { prisma } from "../../../../prisma/prisma.js";
import { PolicyEngine } from "../../agent/policy/policy.engine.js";
import { createStorageService } from "../../../infrastructure/storage/storage.service.js";
import { getImageGenerator, getVideoGenerator } from "../generators/index.js";
import { getVideoComposer } from "../generators/composer.js";
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

  async function ingestGeneratedMedia(input: {
    sourceUrl?: string;
    contentBase64?: string;
    contentType?: string;
    mediaType: "IMAGE" | "VIDEO";
    metadata: Record<string, unknown>;
  }) {
    if (input.contentBase64) {
      return storageService.ingestBuffer({
        profileId: profile.id,
        body: Buffer.from(input.contentBase64, "base64"),
        contentType:
          input.contentType ??
          (input.mediaType === "VIDEO" ? "video/mp4" : "image/png"),
        kind: "generated",
        mediaType: input.mediaType,
        postId: post.id,
        metadata: input.metadata,
      });
    }

    if (!input.sourceUrl) {
      throw new Error("Generator returned neither URL nor binary content");
    }

    return storageService.ingestUrl({
      profileId: profile.id,
      sourceUrl: input.sourceUrl,
      mediaType: input.mediaType,
      kind: "generated",
      postId: post.id,
      contentType: input.contentType,
      metadata: input.metadata,
    });
  }

  try {
    if (isVideo) {
      const imageGen = getImageGenerator();
      const videoGen = getVideoGenerator();
      const composer = getVideoComposer();
      const shots = scenario.shots?.length
        ? scenario.shots.slice(0, 8)
        : [{
            durationSec: 8,
            visualBrief: scenario.visualBrief,
          }];

      const scenes: Array<{ url: string; durationSec?: number }> = [];

      for (let index = 0; index < shots.length; index += 1) {
        const shot = shots[index];
        if (!shot) continue;

        const frame = await imageGen.generate({
          profileId: input.profileId,
          prompt: shot.visualBrief.prompt,
          negativePrompt: shot.visualBrief.negativePrompt,
          aspectRatio: "9:16",
          references,
          visualIdentity: profile.visualIdentity,
        });

        const { asset: frameAsset } = await ingestGeneratedMedia({
          sourceUrl: frame.url,
          contentBase64: frame.contentBase64,
          mediaType: "IMAGE",
          contentType: frame.mimeType,
          metadata: {
            provider: frame.provider,
            model: frame.model,
            prompt: shot.visualBrief.prompt,
            role: "reel-scene-frame",
            sceneIndex: index,
          },
        });

        const scene = await videoGen.generate({
          profileId: input.profileId,
          prompt: shot.visualBrief.prompt,
          startImageUrl: frameAsset.url,
          aspectRatio: "9:16",
          references,
          visualIdentity: profile.visualIdentity,
          durationSec: shot.durationSec,
        });

        const { asset: sceneAsset } = await ingestGeneratedMedia({
          sourceUrl: scene.url,
          contentBase64: scene.contentBase64,
          mediaType: "VIDEO",
          contentType: scene.mimeType,
          metadata: {
            provider: scene.provider,
            model: scene.model,
            prompt: shot.visualBrief.prompt,
            role: "reel-scene-video",
            sceneIndex: index,
          },
        });

        scenes.push({
          url: sceneAsset.url,
          durationSec: shot.durationSec,
        });
      }

      const composed = await composer.compose({
        scenes,
        width: 720,
        height: 1280,
        fps: 30,
        outputFormat: "mp4",
      });

      const { asset } = await ingestGeneratedMedia({
        contentBase64: composed.contentBase64,
        mediaType: "VIDEO",
        contentType: composed.mimeType,
        metadata: {
          provider: "ffmpeg",
          model: "ffmpeg",
          role: "reel-final",
          sceneCount: scenes.length,
        },
      });

      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          width: composed.width,
          height: composed.height,
          durationMs: composed.durationMs,
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

        const { asset } = await ingestGeneratedMedia({
          sourceUrl: gen.url,
          contentBase64: gen.contentBase64,
          mediaType: "IMAGE",
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

      const { asset } = await ingestGeneratedMedia({
        sourceUrl: gen.url,
        contentBase64: gen.contentBase64,
        mediaType: "IMAGE",
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
