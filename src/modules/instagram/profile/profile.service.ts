import { env } from "../../../config/env.js";
import { createInstagramClient } from "../client/instagram.client.js";

export function createInstagramProfileService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  async function getProfile() {
    return instagramClient.getProfile();
  }

  return {
    getProfile,
  };
}
