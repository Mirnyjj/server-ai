import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  INSTAGRAM_TOKEN_ENCRYPTION_KEY: z.string().min(32),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(8000),
  INSTAGRAM_APP_ID: z.string().min(1),
  INSTAGRAM_APP_SECRET: z.string().min(1),
  INSTAGRAM_REDIRECT_URI: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),

  INSTAGRAM_API_VERSION: z.string().min(1),

  /** Temporary dev-only access token. Prefer DB-stored encrypted tokens in production. */
  INSTAGRAM_MARKER: z.string().optional(),

  /** Meta webhook verification token (must match the value configured in Meta App). */
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),

  /** App secret used for X-Hub-Signature-256 verification. Falls back to INSTAGRAM_APP_SECRET. */
  INSTAGRAM_WEBHOOK_APP_SECRET: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");
  console.error(result.error.flatten().fieldErrors);

  process.exit(1);
}

export const env = result.data;
