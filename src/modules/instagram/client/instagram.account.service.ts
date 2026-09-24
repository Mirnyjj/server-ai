import { env } from "../../../config/env";
import { prisma } from "../../../../prisma/prisma";
import { createInstagramClient } from "./instagram.client";

export async function syncInstagramAccount(
  profileId: string,
  accessToken: string,
) {
  const client = createInstagramClient({
    apiVersion: env.INSTAGRAM_API_VERSION,
    accessToken,
  });

  const instagram = await client.getProfile();

  const instagramUserId = instagram.user_id ?? instagram.id;

  if (!instagramUserId) {
    throw new Error("Instagram API did not return user_id");
  }

  return prisma.instagramAccount.upsert({
    where: {
      instagramUserId,
    },
    create: {
      profileId,
      instagramUserId,
      username: instagram.username ?? null,
      name: instagram.name ?? null,
      accountType: instagram.account_type ?? null,
      profilePictureUrl: instagram.profile_picture_url ?? null,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
    update: {
      profileId,
      username: instagram.username ?? null,
      name: instagram.name ?? null,
      accountType: instagram.account_type ?? null,
      profilePictureUrl: instagram.profile_picture_url ?? null,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      lastError: null,
      lastErrorAt: null,
    },
  });
}
