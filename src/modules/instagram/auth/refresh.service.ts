import {
  decryptSecret,
  encryptSecret,
} from "../../../lib/crypto/secret.service";
import {
  findInstagramConnection,
  updateInstagramConnectionToken,
} from "./connection.repository";
import { refreshLongLivedToken } from "./token.service";

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
