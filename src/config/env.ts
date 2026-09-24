import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    INSTAGRAM_TOKEN_ENCRYPTION_KEY: z.string().min(32),
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().positive().default(8000),

    INSTAGRAM_APP_ID: z.string().min(1).optional(),
    INSTAGRAM_APP_SECRET: z.string().min(1).optional(),
    INSTAGRAM_REDIRECT_URI: z.string().url().optional(),

    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1),

    INSTAGRAM_API_VERSION: z.string().min(1),
    INSTAGRAM_MARKER: z.string().optional(),
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
    INSTAGRAM_WEBHOOK_APP_SECRET: z.string().optional(),

    /** Telegram Bot API token from @BotFather. Optional — control plane disabled if unset. */
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),

    /**
     * Comma-separated chat IDs allowed to control the bot.
     * If empty, bot accepts any chat (dev only — set in production).
     */
    TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),

    /** Public HTTPS URL for Telegram webhook, e.g. https://api.example.com/api/telegram/webhook */
    TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    const hasHttpsRedirect =
      !!data.INSTAGRAM_REDIRECT_URI &&
      data.INSTAGRAM_REDIRECT_URI.startsWith("https://");

    const isProd = data.NODE_ENV === "production";

    if (isProd) {
      if (!data.INSTAGRAM_REDIRECT_URI?.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_REDIRECT_URI"],
          message: "Production requires INSTAGRAM_REDIRECT_URI with https://",
        });
      }
      if (!data.INSTAGRAM_APP_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_APP_ID"],
          message: "Required in production",
        });
      }
      if (!data.INSTAGRAM_APP_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_APP_SECRET"],
          message: "Required in production",
        });
      }
      return;
    }

    if (!hasHttpsRedirect) {
      if (!data.INSTAGRAM_MARKER) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_MARKER"],
          message:
            "Local dev mode (no HTTPS INSTAGRAM_REDIRECT_URI): set INSTAGRAM_MARKER to a valid Instagram access token",
        });
      }
    } else {
      if (!data.INSTAGRAM_APP_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_APP_ID"],
          message: "Required when INSTAGRAM_REDIRECT_URI is set",
        });
      }
      if (!data.INSTAGRAM_APP_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_APP_SECRET"],
          message: "Required when INSTAGRAM_REDIRECT_URI is set",
        });
      }
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;

export function isInstagramDevMode(): boolean {
  if (env.NODE_ENV === "production") return false;
  const uri = env.INSTAGRAM_REDIRECT_URI;
  if (!uri || !uri.startsWith("https://")) return true;
  return false;
}

export function isOAuthEnabled(): boolean {
  return (
    !isInstagramDevMode() &&
    !!env.INSTAGRAM_REDIRECT_URI?.startsWith("https://") &&
    !!env.INSTAGRAM_APP_ID &&
    !!env.INSTAGRAM_APP_SECRET
  );
}

export function isWebhooksEnabled(): boolean {
  if (isInstagramDevMode()) return false;
  return !!env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
}

/** Telegram control plane available when bot token is set */
export function isTelegramEnabled(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN;
}

export function getTelegramAllowedChatIds(): number[] {
  if (!env.TELEGRAM_ALLOWED_CHAT_IDS) return [];
  return env.TELEGRAM_ALLOWED_CHAT_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => !Number.isNaN(n));
}
