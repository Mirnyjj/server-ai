import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";

export function createInstagramWebhookService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  async function subscribeToWebhooks(instagramUserId: string) {
    return instagramClient.subscribeToWebhooks(instagramUserId, [
      "comments",
      "messages",
    ]);
  }

  async function handleEvent(payload: unknown) {
    console.dir(payload, { depth: null });
  }

  return {
    subscribeToWebhooks,
    handleEvent,
  };
}
