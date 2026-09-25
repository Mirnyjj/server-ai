import type { FastifyInstance } from "fastify";
import { resolveAccessToken, resolveAccessTokenByProfileId } from "../auth/token.resolver.js";
import { createInstagramProfileService } from "./profile.service.js";
import { syncInstagramAccount } from "../client/instagram.account.service.js";

export async function registerInstagramProfileRoutes(app: FastifyInstance) {
  app.get("/api/instagram/profile", async (request, reply) => {
    const query = request.query as {
      instagramUserId?: string;
    };

    try {
      const accessToken = await resolveAccessToken({
        instagramUserId: query.instagramUserId,
      });
      const profileService = createInstagramProfileService(accessToken);
      return profileService.getProfile();
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to get profile",
      });
    }
  });

  app.post<{
    Body: {
      profileId: string;
    };
  }>("/api/instagram/accounts/sync", async (request, reply) => {
    const { profileId } = request.body;

    if (!profileId) {
      return reply.code(400).send({
        error: "profileId is required",
      });
    }

    try {
      const accessToken = await resolveAccessTokenByProfileId(profileId);
      const account = await syncInstagramAccount(profileId, accessToken);

      return reply.code(200).send(account);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Instagram account",
      });
    }
  });
}
