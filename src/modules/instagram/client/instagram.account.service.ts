import { prisma } from "../../../../prisma/prisma";
import { createInstagramClient } from "./instagram.client";

export async function syncInstagramAccount(
  profileId: string,
  accessToken: string,
) {
  const client = createInstagramClient({
    apiVersion: process.env.INSTAGRAM_API_VERSION ?? "v26.0",
    accessToken,
  });

  const instagram = await client.getProfile();

  return prisma.instagramAccount.upsert({
    where: {
      instagramUserId: instagram.user_id,
    },
    create: {
      profileId,
      instagramUserId: instagram.user_id!,
      username: instagram.username,
      name: instagram.name,
      accountType: instagram.account_type,
      profilePictureUrl: instagram.profile_picture_url,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
    update: {
      profileId,
      username: instagram.username,
      name: instagram.name,
      accountType: instagram.account_type,
      profilePictureUrl: instagram.profile_picture_url,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      lastError: null,
      lastErrorAt: null,
    },
  });
}
