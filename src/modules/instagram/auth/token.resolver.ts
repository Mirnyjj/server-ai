import { env } from "../../../config/env.js";
import { decryptSecret } from "../../../lib/crypto/secret.service.js";
import { prisma } from "../../../../prisma/prisma.js";

/**
 * Resolves an Instagram access token for API calls.
 *
 * Priority:
 * 1. Active InstagramConnection for the given instagramUserId / accountId (encrypted in DB)
 * 2. INSTAGRAM_MARKER env (dev/test only)
 *
 * Throws if neither is available.
 */
export async function resolveAccessToken(options?: {
  instagramUserId?: string;
  instagramAccountId?: string;
}): Promise<string> {
  if (options?.instagramAccountId) {
    const connection = await prisma.instagramConnection.findUnique({
      where: { instagramAccountId: options.instagramAccountId },
    });

    if (connection?.status === "ACTIVE" && connection.accessTokenEncrypted) {
      return decryptSecret(connection.accessTokenEncrypted);
    }
  }

  if (options?.instagramUserId) {
    const account = await prisma.instagramAccount.findUnique({
      where: { instagramUserId: options.instagramUserId },
      include: { connection: true },
    });

    if (
      account?.connection?.status === "ACTIVE" &&
      account.connection.accessTokenEncrypted
    ) {
      return decryptSecret(account.connection.accessTokenEncrypted);
    }
  }

  if (env.INSTAGRAM_MARKER) {
    return env.INSTAGRAM_MARKER;
  }

  throw new Error(
    "No Instagram access token available. Connect an account via OAuth or set INSTAGRAM_MARKER for development.",
  );
}

/**
 * Resolves token by AiProfile id (looks up first ACTIVE InstagramAccount).
 */
export async function resolveAccessTokenByProfileId(
  profileId: string,
): Promise<string> {
  const account = await prisma.instagramAccount.findFirst({
    where: {
      profileId,
      status: "ACTIVE",
    },
    include: { connection: true },
    orderBy: { updatedAt: "desc" },
  });

  if (
    account?.connection?.status === "ACTIVE" &&
    account.connection.accessTokenEncrypted
  ) {
    return decryptSecret(account.connection.accessTokenEncrypted);
  }

  if (env.INSTAGRAM_MARKER) {
    return env.INSTAGRAM_MARKER;
  }

  throw new Error(
    `No active Instagram connection for profile ${profileId}. Connect via OAuth or set INSTAGRAM_MARKER.`,
  );
}
