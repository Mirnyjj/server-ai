import {
  env,
  getTelegramAllowedChatIds,
  isTelegramEnabled,
} from "../../config/env.js";
import { sendTelegramMessage } from "./telegram.client.js";

function targetChats(): (number | string)[] {
  const allowed = getTelegramAllowedChatIds();
  if (allowed.length > 0) return allowed;
  // No allowlist — skip broadcast (safe default)
  return [];
}

async function broadcast(
  text: string,
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  },
) {
  if (!isTelegramEnabled()) return { sent: 0 };

  const chats = targetChats();
  if (chats.length === 0) {
    console.warn(
      "[telegram] TELEGRAM_ALLOWED_CHAT_IDS empty — notification skipped",
    );
    return { sent: 0 };
  }

  let sent = 0;
  for (const chatId of chats) {
    try {
      await sendTelegramMessage(chatId, text, {
        reply_markup: replyMarkup,
      });
      sent++;
    } catch (error) {
      console.error(`[telegram] failed to send to ${chatId}:`, error);
    }
  }
  return { sent };
}

/** TZ §25 — sensitive comment escalation */
export async function notifySensitiveComment(input: {
  commentId: string;
  username?: string | null;
  text: string;
  category?: string | null;
  suggestedReply?: string | null;
  postId?: string;
}) {
  const text = [
    `<b>🚨 SENSITIVE COMMENT</b>`,
    ``,
    `<b>@${escapeHtml(input.username ?? "unknown")}</b>`,
    `Category: <code>${escapeHtml(input.category ?? "?")}</code>`,
    ``,
    `Message:`,
    `<i>${escapeHtml(truncate(input.text, 500))}</i>`,
    ``,
    input.suggestedReply
      ? `Suggested:\n<code>${escapeHtml(truncate(input.suggestedReply, 300))}</code>`
      : "No suggested reply",
    ``,
    `id: <code>${input.commentId}</code>`,
  ].join("\n");

  return broadcast(text, {
    inline_keyboard: [
      [
        {
          text: "✅ Send suggested",
          callback_data: `c_send:${input.commentId}`,
        },
        {
          text: "⏭ Ignore",
          callback_data: `c_ignore:${input.commentId}`,
        },
      ],
    ],
  });
}

/** TZ §25 — sensitive DM escalation */
export async function notifySensitiveDm(input: {
  messageId: string;
  username?: string | null;
  text: string;
  category?: string | null;
  suggestedReply?: string | null;
}) {
  const text = [
    `<b>🚨 SENSITIVE DM</b>`,
    ``,
    `<b>@${escapeHtml(input.username ?? "unknown")}</b>`,
    `Category: <code>${escapeHtml(input.category ?? "?")}</code>`,
    ``,
    `Message:`,
    `<i>${escapeHtml(truncate(input.text, 500))}</i>`,
    ``,
    input.suggestedReply
      ? `Suggested:\n<code>${escapeHtml(truncate(input.suggestedReply, 300))}</code>`
      : "No suggested reply",
    ``,
    `id: <code>${input.messageId}</code>`,
  ].join("\n");

  return broadcast(text, {
    inline_keyboard: [
      [
        {
          text: "✅ Send suggested",
          callback_data: `m_send:${input.messageId}`,
        },
        {
          text: "⏭ Ignore",
          callback_data: `m_ignore:${input.messageId}`,
        },
      ],
    ],
  });
}

export async function notifyAuthRequired(input: {
  profileId: string;
  username?: string | null;
  reason: string;
}) {
  const text = [
    `<b>⚠️ Instagram re-auth required</b>`,
    ``,
    `Account: @${escapeHtml(input.username ?? "?")}`,
    `Profile: <code>${input.profileId}</code>`,
    `Reason: ${escapeHtml(input.reason)}`,
    ``,
    isOAuthHint(),
  ].join("\n");

  return broadcast(text);
}

export async function notifyInfo(message: string) {
  return broadcast(message);
}

function isOAuthHint(): string {
  if (env.INSTAGRAM_REDIRECT_URI?.startsWith("https://")) {
    return `Open: GET /api/instagram/auth/login?profileId=...`;
  }
  return `Dev mode: POST /api/instagram/auth/dev/bootstrap`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
