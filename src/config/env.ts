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

    /** Optional in local dev mode (no HTTPS redirect). Required for production OAuth. */
    INSTAGRAM_APP_ID: z.string().min(1).optional(),
    INSTAGRAM_APP_SECRET: z.string().min(1).optional(),

    /**
     * OAuth callback URL. Must be public HTTPS for real OAuth + webhooks.
     * If unset or not HTTPS → local dev mode (INSTAGRAM_MARKER required).
     */
    INSTAGRAM_REDIRECT_URI: z.string().url().optional(),

    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1),

    INSTAGRAM_API_VERSION: z.string().min(1),

    /** Dev-only long-lived access token. Required when OAuth/webhooks are unavailable. */
    INSTAGRAM_MARKER: z.string().optional(),

    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
    INSTAGRAM_WEBHOOK_APP_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasHttpsRedirect =
      !!data.INSTAGRAM_REDIRECT_URI &&
      data.INSTAGRAM_REDIRECT_URI.startsWith("https://");

    const isProd = data.NODE_ENV === "production";

    // Production always requires full OAuth setup
    if (isProd) {
      if (!data.INSTAGRAM_REDIRECT_URI?.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["INSTAGRAM_REDIRECT_URI"],
          message:
            "Production requires INSTAGRAM_REDIRECT_URI with https://",
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

    // Non-production without HTTPS redirect → local dev mode
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
      // HTTPS redirect present → OAuth enabled, app id/secret required
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

/**
 * Local / tunnel-less development mode.
 *
 * True when:
 * - not production, AND
 * - INSTAGRAM_REDIRECT_URI is missing or not HTTPS
 *
 * In this mode:
 * - OAuth login/callback are disabled (return clear error / status)
 * - Webhooks are soft-disabled (accept but no-op or skip signature)
 * - All API calls use INSTAGRAM_MARKER
 * - Account can be bootstrapped via POST /api/instagram/auth/dev/bootstrap
 */
export function isInstagramDevMode(): boolean {
  if (env.NODE_ENV === "production") {
    return false;
  }

  const uri = env.INSTAGRAM_REDIRECT_URI;
  if (!uri || !uri.startsWith("https://")) {
    return true;
  }

  return false;
}

/** OAuth is only available with HTTPS redirect + app credentials */
export function isOAuthEnabled(): boolean {
  return (
    !isInstagramDevMode() &&
    !!env.INSTAGRAM_REDIRECT_URI?.startsWith("https://") &&
    !!env.INSTAGRAM_APP_ID &&
    !!env.INSTAGRAM_APP_SECRET
  );
}

/** Webhooks need public HTTPS endpoint + verify token; disabled in local dev mode */
export function isWebhooksEnabled(): boolean {
  if (isInstagramDevMode()) {
    return false;
  }
  return !!env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
}
