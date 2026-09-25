import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

import {
  env,
  getTelegramAllowedChatIds,
  isTelegramEnabled,
} from "../../config/env.js";

import {
  getTelegramMe,
  setTelegramWebhook,
  deleteTelegramWebhook,
} from "./telegram.client.js";

import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "./telegram.handlers.js";

import { notifyInfo } from "./telegram.notify.js";

function isValidTelegramWebhookSecret(value: string | undefined): boolean {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !value) return false;
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function registerTelegramRoutes(app: FastifyInstance) {
  /** Incoming updates from Telegram (set webhook to this URL) */
  app.post("/api/telegram/webhook", async (request, reply) => {
    if (!isTelegramEnabled()) {
      return reply.code(503).send({ error: "telegram_disabled" });
    }

    const secret = request.headers["x-telegram-bot-api-secret-token"];
    if (typeof secret !== "string" || !isValidTelegramWebhookSecret(secret)) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      await handleTelegramUpdate(request.body as TelegramUpdate);

      return reply.code(200).send({ ok: true });
    } catch (error) {
      request.log.error(error);

      // Always 200 to Telegram to avoid retry storms
      return reply.code(200).send({ ok: false });
    }
  });

  app.get("/api/telegram/status", async (_request, reply) => {
    if (!isTelegramEnabled()) {
      return reply.send({
        enabled: false,
        message: "Set TELEGRAM_BOT_TOKEN to enable",
      });
    }

    try {
      const me = await getTelegramMe();

      return reply.send({
        enabled: true,
        bot: me,
        webhookUrl: env.TELEGRAM_WEBHOOK_URL ?? null,
        allowlistConfigured: getTelegramAllowedChatIds().length > 0,
      });
    } catch (error) {
      return reply.code(500).send({
        enabled: true,
        error: error instanceof Error ? error.message : "getMe failed",
      });
    }
  });

  /** Register webhook with Telegram (admin) */
  app.post("/api/telegram/setup-webhook", async (request, reply) => {
    if (!isTelegramEnabled()) {
      return reply.code(503).send({ error: "telegram_disabled" });
    }

    const body = request.body as { url?: string };
    const url = body.url ?? env.TELEGRAM_WEBHOOK_URL;

    if (!url?.startsWith("https://")) {
      return reply.code(400).send({
        error: "HTTPS TELEGRAM_WEBHOOK_URL or body.url required",
      });
    }

    try {
      await setTelegramWebhook(url);

      return reply.send({
        success: true,
        url,
      });
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "setWebhook failed",
      });
    }
  });

  app.delete("/api/telegram/webhook", async (_request, reply) => {
    if (!isTelegramEnabled()) {
      return reply.code(503).send({ error: "telegram_disabled" });
    }

    try {
      await deleteTelegramWebhook();

      return reply.send({
        success: true,
      });
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "deleteWebhook failed",
      });
    }
  });

  /** Test notification to allowlisted chats */
  app.post("/api/telegram/test", async (request, reply) => {
    if (!isTelegramEnabled()) {
      return reply.code(503).send({ error: "telegram_disabled" });
    }

    const result = await notifyInfo("✅ Telegram control plane test OK");

    return reply.send({
      success: true,
      ...result,
    });
  });
}
