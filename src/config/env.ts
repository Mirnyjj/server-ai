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
  INSTAGRAM_MARKER: z.string().min(1),
  INSTAGRAM_APP_SECRET: z.string().min(1),
  INSTAGRAM_REDIRECT_URI: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  INSTAGRAM_API_VERSION: z.string().min(1),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");
  console.error(result.error.flatten().fieldErrors);

  process.exit(1);
}

export const env = result.data;
