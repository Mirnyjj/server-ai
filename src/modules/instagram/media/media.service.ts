import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";

export function createInstagramMediaService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  async function listMedia(instagramUserId: string) {
    return instagramClient.listMedia(instagramUserId);
  }

  return {
    listMedia,
  };
}
