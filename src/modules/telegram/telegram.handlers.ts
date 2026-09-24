import { prisma } from "../../../prisma/prisma";
import {
  env,
  getTelegramAllowedChatIds,
  isInstagramDevMode,
  isOAuthEnabled,
  isTelegramEnabled,
} from "../../config/env";
import { resolveAccessTokenByProfileId } from "../instagram/auth/token.resolver";
import { createInstagramClient } from "../instagram/client/instagram.client";
import { createInstagramCommentsService } from "../instagram/comments/comments.service";
import {
  answerCallbackQuery,
  editMessageText,
  sendTelegramMessage,
} from "./telegram.client";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; username?: string };
    message?: {
      message_id: number;
      chat: { id: number };
      text?: string;
    };
  };
};

function isAuthorized(chatId: number): boolean {
  const allowed = getTelegramAllowedChatIds();
  if (allowed.length === 0) {
    // Dev: allow all if no allowlist
    return env.NODE_ENV !== "production";
  }
  return allowed.includes(chatId);
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (!isTelegramEnabled()) return;

  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) {
    await sendTelegramMessage(chatId, "⛔ Unauthorized chat.");
    return;
  }

  const text = msg.text.trim();
  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase().split("@")[0];

  switch (command) {
    case "/start":
    case "/help":
      await sendTelegramMessage(chatId, HELP_TEXT);
      break;
    case "/status":
      await cmdStatus(chatId);
      break;
    case "/pending":
      await cmdPending(chatId);
      break;
    case "/profiles":
      await cmdProfiles(chatId);
      break;
    case "/sync":
      await cmdSync(chatId, args[0]);
      break;
    case "/connect":
      await cmdConnect(chatId, args[0]);
      break;
    default:
      if (command.startsWith("/")) {
        await sendTelegramMessage(
          chatId,
          "Unknown command. /help for list.",
        );
      }
  }
}

const HELP_TEXT = [
  `<b>AI Instagram Control Plane</b>`,
  ``,
  `/status — system mode & connections`,
  `/profiles — list AI profiles`,
  `/pending — comments/DMs needing human`,
  `/sync &lt;profileId&gt; — media sync`,
  `/connect &lt;profileId&gt; — OAuth / bootstrap hint`,
  `/help — this message`,
  ``,
  `Escalations arrive as alerts with inline buttons.`,
].join("\n");

async function cmdStatus(chatId: number) {
  const accounts = await prisma.instagramAccount.count({
    where: { status: "ACTIVE" },
  });
  const pendingComments = await prisma.comment.count({
    where: { requiresHuman: true, replied: false },
  });
  const pendingDms = await prisma.directMessage.count({
    where: { requiresHuman: true, replied: false, direction: "INBOUND" },
  });

  const text = [
    `<b>Status</b>`,
    `Dev mode: <code>${isInstagramDevMode()}</code>`,
    `OAuth: <code>${isOAuthEnabled()}</code>`,
    `Telegram: <code>on</code>`,
    `Active IG accounts: <b>${accounts}</b>`,
    `Pending comments: <b>${pendingComments}</b>`,
    `Pending DMs: <b>${pendingDms}</b>`,
  ].join("\n");

  await sendTelegramMessage(chatId, text);
}

async function cmdPending(chatId: number) {
  const comments = await prisma.comment.findMany({
    where: { requiresHuman: true, replied: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const dms = await prisma.directMessage.findMany({
    where: { requiresHuman: true, replied: false, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { thread: true },
  });

  if (comments.length === 0 && dms.length === 0) {
    await sendTelegramMessage(chatId, "✅ No pending human reviews.");
    return;
  }

  const lines: string[] = [`<b>Pending review</b>`, ``];

  for (const c of comments) {
    lines.push(
      `💬 <b>Comment</b> @${c.username ?? "?"} [${c.category ?? "?"}]`,
    );
    lines.push(`<i>${escape(c.text.slice(0, 120))}</i>`);
    lines.push(`<code>${c.id}</code>`);
    lines.push(``);
  }

  for (const m of dms) {
    lines.push(
      `✉️ <b>DM</b> @${m.thread.username ?? "?"} [${m.category ?? "?"}]`,
    );
    lines.push(`<i>${escape(m.text.slice(0, 120))}</i>`);
    lines.push(`<code>${m.id}</code>`);
    lines.push(``);
  }

  await sendTelegramMessage(chatId, lines.join("\n"));
}

async function cmdProfiles(chatId: number) {
  const profiles = await prisma.aiProfile.findMany({
    take: 20,
    orderBy: { updatedAt: "desc" },
    include: {
      instagramAccounts: {
        where: { status: "ACTIVE" },
        take: 1,
      },
    },
  });

  if (profiles.length === 0) {
    await sendTelegramMessage(chatId, "No AI profiles yet.");
    return;
  }

  const lines = profiles.map((p) => {
    const ig = p.instagramAccounts[0];
    return `• <b>${escape(p.name)}</b>\n  <code>${p.id}</code>\n  IG: @${ig?.username ?? "not connected"} | auto: ${p.autonomousMode}`;
  });

  await sendTelegramMessage(chatId, `<b>Profiles</b>\n\n${lines.join("\n\n")}`);
}

async function cmdSync(chatId: number, profileId?: string) {
  if (!profileId) {
    await sendTelegramMessage(chatId, "Usage: /sync &lt;profileId&gt;");
    return;
  }

  try {
    const { enqueueMediaSync } = await import("../../infrastructure/queue");
    const job = await enqueueMediaSync({ profileId });
    await sendTelegramMessage(
      chatId,
      `✅ Media sync queued\njob: <code>${job.id}</code>`,
    );
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      `❌ ${error instanceof Error ? error.message : "sync failed"}`,
    );
  }
}

async function cmdConnect(chatId: number, profileId?: string) {
  if (!profileId) {
    await sendTelegramMessage(chatId, "Usage: /connect &lt;profileId&gt;");
    return;
  }

  if (isOAuthEnabled()) {
    const base =
      env.INSTAGRAM_REDIRECT_URI?.replace(/\/api\/instagram\/auth\/callback.*/, "") ??
      "";
    await sendTelegramMessage(
      chatId,
      `Open OAuth:\n<code>${base}/api/instagram/auth/login?profileId=${profileId}</code>`,
    );
  } else {
    await sendTelegramMessage(
      chatId,
      [
        `Local dev mode — OAuth disabled.`,
        `Bootstrap via API:`,
        `<code>POST /api/instagram/auth/dev/bootstrap</code>`,
        `Body: {"profileId":"${profileId}"}`,
      ].join("\n"),
    );
  }
}

async function handleCallback(cq: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = cq.message?.chat.id;
  if (!chatId || !isAuthorized(chatId)) {
    await answerCallbackQuery(cq.id, "Unauthorized");
    return;
  }

  const data = cq.data ?? "";
  const [action, id] = data.split(":");

  try {
    if (action === "c_send" && id) {
      await humanSendComment(id);
      await answerCallbackQuery(cq.id, "Reply sent");
      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          (cq.message.text ?? "") + "\n\n✅ <b>Sent</b>",
        );
      }
    } else if (action === "c_ignore" && id) {
      await prisma.comment.update({
        where: { id },
        data: { requiresHuman: false },
      });
      await answerCallbackQuery(cq.id, "Ignored");
      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          (cq.message.text ?? "") + "\n\n⏭ <b>Ignored</b>",
        );
      }
    } else if (action === "m_send" && id) {
      await humanSendDm(id);
      await answerCallbackQuery(cq.id, "DM sent");
      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          (cq.message.text ?? "") + "\n\n✅ <b>Sent</b>",
        );
      }
    } else if (action === "m_ignore" && id) {
      await prisma.directMessage.update({
        where: { id },
        data: { requiresHuman: false },
      });
      await answerCallbackQuery(cq.id, "Ignored");
      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          (cq.message.text ?? "") + "\n\n⏭ <b>Ignored</b>",
        );
      }
    } else {
      await answerCallbackQuery(cq.id, "Unknown action");
    }
  } catch (error) {
    await answerCallbackQuery(
      cq.id,
      error instanceof Error ? error.message.slice(0, 180) : "Error",
    );
  }
}

async function humanSendComment(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { post: true },
  });
  if (!comment) throw new Error("Comment not found");
  if (!comment.suggestedReply) throw new Error("No suggested reply");

  const accessToken = await resolveAccessTokenByProfileId(comment.post.profileId);
  const service = createInstagramCommentsService(accessToken);
  await service.replyToComment(comment.instagramId, comment.suggestedReply);

  await prisma.comment.update({
    where: { id: commentId },
    data: {
      replied: true,
      replyText: comment.suggestedReply,
      requiresHuman: false,
    },
  });
}

async function humanSendDm(messageId: string) {
  const message = await prisma.directMessage.findUnique({
    where: { id: messageId },
    include: {
      thread: { include: { account: true } },
    },
  });
  if (!message) throw new Error("Message not found");
  if (!message.suggestedReply) throw new Error("No suggested reply");

  const profileId = message.thread.account.profileId;
  const accessToken = await resolveAccessTokenByProfileId(profileId);
  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  await client.sendMessage(
    message.thread.account.instagramUserId,
    message.thread.instagramThreadId,
    message.suggestedReply,
  );

  await prisma.directMessage.update({
    where: { id: messageId },
    data: { replied: true, requiresHuman: false },
  });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
