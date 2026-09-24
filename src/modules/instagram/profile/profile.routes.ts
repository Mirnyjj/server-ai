import type { FastifyInstance } from "fastify";

import { createInstagramProfileService } from "./profile.service";
import { syncInstagramAccount } from "../client/instagram.account.service";

export async function registerInstagramProfileRoutes(app: FastifyInstance) {
  const accessToken = process.env.INSTAGRAM_MARKER;

  if (!accessToken) {
    throw new Error("INSTAGRAM_MARKER is not configured");
  }

  const profileService = createInstagramProfileService(accessToken);

  app.get("/api/instagram/profile", async () => {
    return profileService.getProfile();
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

    const account = await syncInstagramAccount(profileId, accessToken);

    return reply.code(200).send(account);
  });
}
