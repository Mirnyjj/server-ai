import { prisma } from "../../../../prisma/prisma.js";
import { enqueueCreateAndPublish } from "../../../infrastructure/queue/index.js";

/**
 * Map READY Post + MediaAssets → BullMQ create-and-publish job.
 */
export async function enqueuePublishReadyPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      account: true,
      media: {
        orderBy: { sortOrder: "asc" },
        include: { mediaAsset: true },
      },
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  if (post.status !== "READY" && post.status !== "APPROVED") {
    throw new Error(`Post ${postId} status is ${post.status}, expected READY`);
  }

  const assets = post.media
    .map((m) => m.mediaAsset)
    .filter((a) => a && a.status === "ACTIVE" && a.url.startsWith("https://"));

  if (assets.length === 0) {
    throw new Error(`Post ${postId} has no public HTTPS media assets`);
  }

  const instagramUserId = post.account.instagramUserId;
  const caption = post.caption ?? undefined;

  let mediaType: "IMAGE" | "REEL" | "CAROUSEL" | "STORY" | "VIDEO";
  switch (post.type) {
    case "REEL":
      mediaType = "REEL";
      break;
    case "STORY":
      mediaType = "STORY";
      break;
    case "CAROUSEL":
      mediaType = "CAROUSEL";
      break;
    case "VIDEO":
      mediaType = "VIDEO";
      break;
    default:
      mediaType = "IMAGE";
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: "PUBLISHING" },
  });

  if (mediaType === "CAROUSEL") {
    const job = await enqueueCreateAndPublish({
      postId: post.id,
      instagramUserId,
      mediaType: "CAROUSEL",
      caption,
      isAiGenerated: post.isAiGenerated,
      items: assets.map((a) =>
        a.type === "VIDEO" ? { videoUrl: a.url } : { imageUrl: a.url },
      ),
    });
    return { jobId: job.id, mediaType };
  }

  const primary = assets[0];
  const job = await enqueueCreateAndPublish({
    postId: post.id,
    instagramUserId,
    mediaType,
    caption,
    isAiGenerated: post.isAiGenerated,
    imageUrl: primary.type === "IMAGE" ? primary.url : undefined,
    videoUrl: primary.type === "VIDEO" ? primary.url : undefined,
  });

  return { jobId: job.id, mediaType };
}
