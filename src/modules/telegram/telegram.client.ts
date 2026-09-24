import { env } from "../../config/env";

const BASE = () => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export type TelegramInlineButton = {
  text: string;
  callback_data: string;
};

export type SendMessageOptions = {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: {
    inline_keyboard: TelegramInlineButton[][];
  };
  disable_web_page_preview?: boolean;
};

async function tgRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`${BASE()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: T;
  };

  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API ${method} failed`);
  }

  return data.result as T;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: SendMessageOptions = {},
) {
  return tgRequest<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode ?? "HTML",
    reply_markup: options.reply_markup,
    disable_web_page_preview: options.disable_web_page_preview ?? true,
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  return tgRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options: SendMessageOptions = {},
) {
  return tgRequest("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options.parse_mode ?? "HTML",
    reply_markup: options.reply_markup,
  });
}

export async function setTelegramWebhook(url: string) {
  return tgRequest("setWebhook", { url, allowed_updates: ["message", "callback_query"] });
}

export async function deleteTelegramWebhook() {
  return tgRequest("deleteWebhook", { drop_pending_updates: false });
}

export async function getTelegramMe() {
  return tgRequest<{ id: number; username?: string; first_name?: string }>(
    "getMe",
  );
}
