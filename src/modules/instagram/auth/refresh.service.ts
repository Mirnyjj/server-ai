import {
  decryptSecret,
  encryptSecret,
} from "../../../lib/crypto/secret.service.js";
import {
  findInstagramConnection,
  updateInstagramConnectionToken,
} from "./connection.repository.js";
import { refreshLongLivedToken } from "./token.service.js";

export async function refreshInstagramConnection(instagramAccountId: string) {
  const connection = await findInstagramConnection(instagramAccountId);

  if (!connection) {
    throw new Error("Instagram connection not found");
  }

  const accessToken = decryptSecret(connection.accessTokenEncrypted);

  const refreshed = await refreshLongLivedToken({
    accessToken,
  });

  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await updateInstagramConnectionToken(connection.id, {
    accessTokenEncrypted: encryptSecret(refreshed.access_token),
    tokenExpiresAt,
  });

  return {
    tokenExpiresAt,
  };
}
