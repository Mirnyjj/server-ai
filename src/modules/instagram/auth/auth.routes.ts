import type { FastifyInstance } from "fastify";
import { createInstagramAuthService } from "./auth.service";
import { consumeOAuthState, createOAuthState } from "./state.service";

export async function registerInstagramAuthRoutes(app: FastifyInstance) {
  const authService = createInstagramAuthService();

  app.get("/api/instagram/auth/login", async (request, reply) => {
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
