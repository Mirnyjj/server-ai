import type { FastifyInstance } from "fastify";
import { env, isInstagramDevMode, isOAuthEnabled } from "../../../config/env";
import { createInstagramAuthService } from "./auth.service";
import { consumeOAuthState, createOAuthState } from "./state.service";
import { bootstrapDevAccount } from "./dev-bootstrap.service";

export async function registerInstagramAuthRoutes(app: FastifyInstance) {
  const authService = createInstagramAuthService();

  /** Current auth / dev-mode status */
  app.get("/api/instagram/auth/status", async () => {
    return {
      devMode: isInstagramDevMode(),
      oauthEnabled: isOAuthEnabled(),
      hasMarker: !!env.INSTAGRAM_MARKER,
      redirectUri: env.INSTAGRAM_REDIRECT_URI ?? null,
      message: isInstagramDevMode()
        ? "Local dev mode: OAuth and webhooks disabled. Using INSTAGRAM_MARKER. Bootstrap account via POST /api/instagram/auth/dev/bootstrap"
        : "OAuth mode: use GET /api/instagram/auth/login?profileId=...",
    };
  });

  /**
   * Dev-only: create/update InstagramAccount + optional Connection from MARKER.
   * Does not require OAuth or public HTTPS.
   */
  app.post("/api/instagram/auth/dev/bootstrap", async (request, reply) => {
    if (!isInstagramDevMode()) {
      return reply.code(403).send({
        error: "dev_bootstrap_only_in_dev_mode",
        message:
          "This endpoint is only available when INSTAGRAM_REDIRECT_URI is unset or not HTTPS",
      });
    }

    if (!env.INSTAGRAM_MARKER) {
      return reply.code(400).send({
        error: "INSTAGRAM_MARKER is required for dev bootstrap",
      });
    }

    const body = request.body as {
      profileId?: string;
    };

    if (!body.profileId) {
      return reply.code(400).send({
        error: "profileId is required",
      });
    }

    try {
      const result = await bootstrapDevAccount({
        profileId: body.profileId,
        accessToken: env.INSTAGRAM_MARKER,
      });

      return reply.send({
        success: true,
        devMode: true,
        account: result.account,
        connectionSaved: result.connectionSaved,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Dev bootstrap failed",
      });
    }
  });

  app.get("/api/instagram/auth/login", async (request, reply) => {
    if (!isOAuthEnabled()) {
      return reply.code(503).send({
        error: "oauth_disabled",
        devMode: isInstagramDevMode(),
        message: isInstagramDevMode()
          ? "OAuth requires a public HTTPS INSTAGRAM_REDIRECT_URI. In local dev use INSTAGRAM_MARKER and POST /api/instagram/auth/dev/bootstrap"
          : "OAuth is not configured (missing APP_ID / APP_SECRET / REDIRECT_URI)",
      });
    }

    const query = request.query as {
      profileId?: string;
    };

    if (!query.profileId) {
      return reply.code(400).send({
        error: "profileId is required",
      });
    }

    const state = await createOAuthState(query.profileId);

    return reply.redirect(authService.createAuthorizationUrl(state));
  });

  app.get("/api/instagram/auth/callback", async (request, reply) => {
    if (!isOAuthEnabled()) {
      return reply.code(503).send({
        error: "oauth_disabled",
        devMode: isInstagramDevMode(),
        message:
          "OAuth callback is not available in local dev mode without HTTPS redirect URI",
      });
    }

    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_reason?: string;
      error_description?: string;
    };

    if (query.error) {
      return reply.code(400).send({
        error: query.error,
        reason: query.error_reason,
        description: query.error_description,
      });
    }

    if (!query.code) {
      return reply.code(400).send({
        error: "missing_authorization_code",
      });
    }

    if (!query.state) {
      return reply.code(400).send({
        error: "missing_state",
      });
    }

    const profileId = await consumeOAuthState(query.state);

    if (!profileId) {
      return reply.code(400).send({
        error: "invalid_or_expired_state",
      });
    }

    const result = await authService.authorize(query.code, profileId);

    return {
      success: true,
      instagramUserId: result.instagramUserId,
      permissions: result.permissions,
    };
  });
}
