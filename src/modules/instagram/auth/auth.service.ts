import { env } from "../../../config/env";
import { encryptSecret } from "../../../lib/crypto/secret.service";
import { createInstagramClient } from "../client/instagram.client";
import { upsertInstagramAccount } from "./account.repository";
import { upsertInstagramConnection } from "./connection.repository";
import type { InstagramAuthResult } from "./auth.types";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from "./token.service";

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
];

export function createInstagramAuthService() {
  function createAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID,
      redirect_uri: env.INSTAGRAM_REDIRECT_URI,
      response_type: "code",
      scope: INSTAGRAM_SCOPES.join(","),
      state,
    });

    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async function authorize(
    code: string,
    profileId: string,
  ): Promise<InstagramAuthResult> {
    const shortLivedToken = await exchangeCodeForToken({
      code,
      appId: env.INSTAGRAM_APP_ID,
      appSecret: env.INSTAGRAM_APP_SECRET,
      redirectUri: env.INSTAGRAM_REDIRECT_URI,
    });

    const longLivedToken = await exchangeForLongLivedToken({
      accessToken: shortLivedToken.access_token,
      appSecret: env.INSTAGRAM_APP_SECRET,
    });

    const instagramClient = createInstagramClient({
      accessToken: longLivedToken.access_token,
      apiVersion: env.INSTAGRAM_API_VERSION,
    });

    const profile = await instagramClient.getProfile();

    const instagramUserId =
      profile.user_id ?? profile.id ?? shortLivedToken.user_id;

    const instagramAccount = await upsertInstagramAccount({
      profileId,
      instagramUserId,
      username: profile.username,
      name: profile.name,
      profilePictureUrl: profile.profile_picture_url,
      accountType: profile.account_type,
    });

    const tokenExpiresAt = new Date(
      Date.now() + longLivedToken.expires_in * 1000,
    );

    await upsertInstagramConnection({
      instagramAccountId: instagramAccount.id,
      accessTokenEncrypted: encryptSecret(longLivedToken.access_token),
      tokenExpiresAt,
      scopes: shortLivedToken.permissions
        ? shortLivedToken.permissions.split(",")
        : INSTAGRAM_SCOPES,
    });

    return {
      instagramUserId,
      permissions: shortLivedToken.permissions
        ? shortLivedToken.permissions.split(",")
        : INSTAGRAM_SCOPES,
    };
  }

  return {
    createAuthorizationUrl,
    authorize,
  };
}
