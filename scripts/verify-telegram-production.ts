import "dotenv/config";

import { env, getTelegramAllowedChatIds, isTelegramEnabled } from "../src/config/env.js";
import { getTelegramMe, getTelegramWebhookInfo } from "../src/modules/telegram/telegram.client.js";

if (!isTelegramEnabled()) {
  throw new Error("TELEGRAM_BOT_TOKEN is not configured");
}

const me = await getTelegramMe();
const webhook = await getTelegramWebhookInfo();
const expectedUrl = env.TELEGRAM_WEBHOOK_URL;

const result = {
  bot: {
    id: me.id,
    username: me.username ?? null,
  },
  webhook: {
    configured: Boolean(webhook.url),
    url: webhook.url || null,
    pendingUpdates: webhook.pending_update_count,
    lastError: webhook.last_error_message ?? null,
  },
  expectedWebhookUrl: expectedUrl ?? null,
  allowlistConfigured: getTelegramAllowedChatIds().length > 0,
  allowedChatCount: getTelegramAllowedChatIds().length,
};

console.log("[1/3] Telegram Bot API: PASS");

if (!expectedUrl) {
  throw new Error("TELEGRAM_WEBHOOK_URL is not configured");
}

if (webhook.url !== expectedUrl) {
  throw new Error(
    `Telegram webhook mismatch: expected ${expectedUrl}, got ${webhook.url || "<empty>"}`,
  );
}

console.log("[2/3] Telegram webhook: PASS");

if (getTelegramAllowedChatIds().length === 0) {
  throw new Error("TELEGRAM_ALLOWED_CHAT_IDS is empty in production");
}

if (webhook.last_error_message) {
  throw new Error(
    `Telegram reports webhook error: ${webhook.last_error_message}`,
  );
}

console.log("[3/3] Telegram security/health: PASS");
console.log("");
console.log("TELEGRAM PRODUCTION READ CHECK: PASS");
console.log(JSON.stringify(result, null, 2));
