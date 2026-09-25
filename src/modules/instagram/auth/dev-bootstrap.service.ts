import { env } from "../../../config/env.js";
import { encryptSecret } from "../../../lib/crypto/secret.service.js";
import { createInstagramClient } from "../client/instagram.client.js";
import { upsertInstagramAccount } from "./account.repository.js";
import { upsertInstagramConnection } from "./connection.repository.js";

/**
 * Local dev helper: using INSTAGRAM_MARKER, fetch profile and upsert
 * InstagramAccount (+ Connection with encrypted marker token).
 *
 * Does not require OAuth, HTTPS redirect, or webhooks.
 */
export async function bootstrapDevAccount(input: {
  profileId: string;
  accessToken: string;
}) {
  const client = createInstagramClient({
    accessToken: input.accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  const profile = await client.getProfile();
  const instagramUserId = profile.user_id ?? profile.id;

  if (!instagramUserId) {
    throw new Error("Instagram API did not return user_id for MARKER token");
  }

  const account = await upsertInstagramAccount({
    profileId: input.profileId,
    instagramUserId,
    username: profile.username,
    name: profile.name,
    profilePictureUrl: profile.profile_picture_url,
    accountType: profile.account_type,
  });

  // Store marker as encrypted connection so token.resolver prefers DB path
  // Long-lived markers often have no reliable expires_in — use +60 days
  const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  await upsertInstagramConnection({
    instagramAccountId: account.id,
    accessTokenEncrypted: encryptSecret(input.accessToken),
    tokenExpiresAt,
    scopes: ["dev_marker"],
  });

  return {
    account,
    connectionSaved: true,
  };
}
