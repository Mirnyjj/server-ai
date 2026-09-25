import { prisma } from "../../../prisma/prisma.js";
import { enqueuePublishReadyPost } from "../ai/pipeline/publish-from-post.js";
import { runContentPipeline } from "../ai/pipeline/content.pipeline.js";
import type { ContentScenario } from "../ai/content/scenario.types.js";
import {
  sendTelegramMediaGroup,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
} from "./telegram.client.js";

const POST_TYPES = ["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO"] as const;
type ReviewPostType = (typeof POST_TYPES)[number];

export function parseTelegramPostType(value?: string): ReviewPostType | undefined {
  const normalized = value?.trim().toUpperCase();
  return POST_TYPES.includes(normalized as ReviewPostType)
    ? (normalized as ReviewPostType)
    : undefined;
}

export async function generateTelegramContent(input: {
  chatId: number;
  profileId: string;
  postType?: ReviewPostType;
  topicHint?: string;
}) {
  const result = await runContentPipeline({
    profileId: input.profileId,
    postType: input.postType,
    topicHint: input.topicHint,
  });

  await sendTelegramPostReview(input.chatId, result.postId);
  return result;
}

export async function sendTelegramPostReview(chatId: number, postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      media: { orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
    },
  });

  if (!post) throw new Error("Публикация не найдена");

  const assets = post.media
    .map((item) => item.mediaAsset)
    .filter((asset) => asset.status === "ACTIVE" && asset.url.startsWith("https://"));

  if (assets.length === 0) {
    await sendTelegramMessage(chatId, "⚠️ Контент создан, но media URL недоступен для Telegram.");
    return;
  }

  const typeLabel: Record<string, string> = {
    PHOTO: "Фото",
    REEL: "Reel",
    STORY: "Story",
    CAROUSEL: "Карусель",
    VIDEO: "Видео",
  };

  const header = [
    "<b>Контент на проверку</b>",
    "",
    `Тип: <b>${typeLabel[post.type] ?? post.type}</b>`,
    `ID: <code>${post.id}</code>`,
    `Статус: <b>${post.status}</b>`,
    "",
    escapeHtml(post.caption?.trim() || "Без подписи").slice(0, 1800),
  ].join("\n");

  if (post.type === "CAROUSEL") {
    await sendTelegramMediaGroup(chatId, assets.slice(0, 10).map((asset) => ({
      type: asset.type === "VIDEO" ? "video" : "photo",
      media: asset.url,
    })));
  } else if (assets[0].type === "VIDEO") {
    await sendTelegramVideo(chatId, assets[0].url);
  } else {
    await sendTelegramPhoto(chatId, assets[0].url);
  }

  await sendTelegramMessage(chatId, header, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Одобрить и опубликовать", callback_data: `post:approve:${post.id}` }],
        [
          { text: "🔄 Перегенерировать", callback_data: `post:regenerate:${post.id}` },
          { text: "❌ Отклонить", callback_data: `post:reject:${post.id}` },
        ],
      ],
    },
  });
}

export async function listTelegramPendingPosts(profileId: string) {
  return prisma.post.findMany({
    where: { profileId, status: "READY" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      media: { orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
    },
  });
}

export async function approveTelegramPost(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Публикация не найдена");
  if (post.status !== "READY") throw new Error(`Нельзя одобрить публикацию со статусом ${post.status}`);

  await prisma.post.update({ where: { id: postId }, data: { status: "APPROVED" } });
  return enqueuePublishReadyPost(postId);
}

export async function rejectTelegramPost(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Публикация не найдена");
  if (post.status !== "READY") throw new Error(`Нельзя отклонить публикацию со статусом ${post.status}`);

  return prisma.post.update({ where: { id: postId }, data: { status: "REJECTED" } });
}

export async function regenerateTelegramPost(chatId: number, postId: string): Promise<string> {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Публикация не найдена");
  if (post.status !== "READY") throw new Error(`Нельзя перегенерировать публикацию со статусом ${post.status}`);

  await prisma.post.update({ where: { id: postId }, data: { status: "REJECTED" } });

  const previousCaption = post.caption?.slice(0, 500) ?? "";
  const result = await runContentPipeline({
    profileId: post.profileId,
    postType: post.type as ContentScenario["postType"],
    topicHint: previousCaption
      ? `Сделай новую вариацию контента. Предыдущая идея/подпись: ${previousCaption}`
      : "Сделай новую вариацию контента.",
  });

  await sendTelegramPostReview(chatId, result.postId);
  return result.postId;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
