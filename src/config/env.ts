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

    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
    TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).optional(),

    LUNA_API_KEY: z.string().optional(),
    LUNA_BASE_URL: z.string().url().optional(),
    LUNA_MODEL: z.string().optional(),
    SEARXNG_BASE_URL: z.string().url().default("http://searxng:8080"),
    SEARXNG_SECRET: z.string().min(16).optional(),
    BRAVE_SEARCH_API_KEY: z.string().min(1).optional(),

    WHISPER_BASE_URL: z.string().url().optional(),
    MCP_SERVER_TOKEN: z.string().min(32).optional(),
    /** fal | openai | http — model is selected independently from the provider */
    IMAGE_MODEL_PROVIDER: z.string().optional(),
    IMAGE_MODEL_API_KEY: z.string().optional(),
    IMAGE_MODEL: z.string().optional(),
    /** Required only for IMAGE_MODEL_PROVIDER=http */
    IMAGE_MODEL_BASE_URL: z.string().url().optional(),

    VIDEO_GENERATOR_PROVIDER: z.string().optional(),
    VIDEO_GENERATOR_API_KEY: z.string().optional(),
    VIDEO_GENERATOR_MODEL: z.string().optional(),
    VIDEO_GENERATOR_BASE_URL: z.string().url().optional(),

    STORAGE_PROVIDER: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_PUBLIC_BASE_URL: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: z.string().optional(),
    STORAGE_ACL: z.string().optional(),
    STORAGE_LOCAL_PATH: z.string().optional(),
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

      const storageProvider = (data.STORAGE_PROVIDER ?? "").toLowerCase();
      if (!["s3", "r2", "minio"].includes(storageProvider)) {
        ctx.addIssue({
          code: "custom",
          path: ["STORAGE_PROVIDER"],
          message: "Production requires STORAGE_PROVIDER=s3|r2|minio",
        });
      }
      for (const [path, value, message] of [
        ["STORAGE_BUCKET", data.STORAGE_BUCKET, "Required in production"],
        ["STORAGE_ACCESS_KEY_ID", data.STORAGE_ACCESS_KEY_ID, "Required in production"],
        ["STORAGE_SECRET_ACCESS_KEY", data.STORAGE_SECRET_ACCESS_KEY, "Required in production"],
        ["STORAGE_PUBLIC_BASE_URL", data.STORAGE_PUBLIC_BASE_URL, "Required in production"],
        ["LUNA_API_KEY", data.LUNA_API_KEY, "Required in production"],
        ["TELEGRAM_BOT_TOKEN", data.TELEGRAM_BOT_TOKEN, "Required in production"],
        ["TELEGRAM_ALLOWED_CHAT_IDS", data.TELEGRAM_ALLOWED_CHAT_IDS, "Required in production"],
        ["TELEGRAM_WEBHOOK_URL", data.TELEGRAM_WEBHOOK_URL, "Required in production"],
        ["TELEGRAM_WEBHOOK_SECRET", data.TELEGRAM_WEBHOOK_SECRET, "Required in production"],
        ["MCP_SERVER_TOKEN", data.MCP_SERVER_TOKEN, "Required in production"],
        ["VIDEO_GENERATOR_PROVIDER", data.VIDEO_GENERATOR_PROVIDER, "Required in production"],
        ["VIDEO_GENERATOR_API_KEY", data.VIDEO_GENERATOR_API_KEY, "Required in production"],
      ] as const) {
        if (!value) {
          ctx.addIssue({ code: "custom", path: [path], message });
        }
      }

      if (data.TELEGRAM_WEBHOOK_URL && !data.TELEGRAM_WEBHOOK_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["TELEGRAM_WEBHOOK_URL"], message: "Production requires TELEGRAM_WEBHOOK_URL with https://" });
      }

      if (data.STORAGE_PUBLIC_BASE_URL && !data.STORAGE_PUBLIC_BASE_URL.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["STORAGE_PUBLIC_BASE_URL"],
          message: "Production requires STORAGE_PUBLIC_BASE_URL with https://",
        });
      }

      const imageProvider = (data.IMAGE_MODEL_PROVIDER ?? "").toLowerCase();
      if (!["fal", "openai", "http"].includes(imageProvider)) {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGE_MODEL_PROVIDER"],
          message: "Production requires IMAGE_MODEL_PROVIDER=fal|openai|http",
        });
      }
      if (["fal", "openai"].includes(imageProvider) && !data.IMAGE_MODEL_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGE_MODEL_API_KEY"],
          message: "Required for IMAGE_MODEL_PROVIDER=fal|openai",
        });
      }
      if (imageProvider === "http" && !data.IMAGE_MODEL_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGE_MODEL_BASE_URL"],
          message: "Required for IMAGE_MODEL_PROVIDER=http",
        });
      }

      const videoProvider = (data.VIDEO_GENERATOR_PROVIDER ?? "").toLowerCase();
      if (!["fal", "http"].includes(videoProvider)) {
        ctx.addIssue({
          code: "custom",
          path: ["VIDEO_GENERATOR_PROVIDER"],
          message: "Production requires VIDEO_GENERATOR_PROVIDER=fal|http",
        });
      }
      if (videoProvider === "http" && !data.VIDEO_GENERATOR_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["VIDEO_GENERATOR_BASE_URL"],
          message: "Required for VIDEO_GENERATOR_PROVIDER=http",
        });
      }

      if (!data.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || !data.INSTAGRAM_WEBHOOK_APP_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_WEBHOOK_APP_SECRET"],
          message: "Production Instagram webhooks require verify token and app secret",
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

export function isLunaEnabled(): boolean {
  return !!env.LUNA_API_KEY;
}
