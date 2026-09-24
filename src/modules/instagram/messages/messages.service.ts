import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";

export function createInstagramMessagesService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  async function sendMessage(
    instagramUserId: string,
    recipientId: string,
    message: string,
  ) {
    return instagramClient.sendMessage(instagramUserId, recipientId, message);
  }

  return {
    sendMessage,
  };
}
