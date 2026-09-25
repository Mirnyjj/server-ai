import { env } from "../../../config/env.js";
import { createInstagramClient } from "../client/instagram.client.js";

export function createInstagramPublishService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  async function publish(instagramUserId: string, containerId: string) {
    return instagramClient.publishContainer(instagramUserId, containerId);
  }

  return {
    publish,
  };
}
