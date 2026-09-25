import { prisma } from "../../../../prisma/prisma.js";

type UpsertInstagramAccountInput = {
  profileId: string;
  instagramUserId: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  accountType?: string;
};

export async function upsertInstagramAccount(
  input: UpsertInstagramAccountInput,
) {
  return prisma.instagramAccount.upsert({
    where: {
      instagramUserId: input.instagramUserId,
    },
    create: {
      profileId: input.profileId,
      instagramUserId: input.instagramUserId,
      username: input.username ?? null,
      name: input.name ?? null,
      profilePictureUrl: input.profilePictureUrl ?? null,
      accountType: input.accountType ?? null,
    },
    update: {
      profileId: input.profileId,
      username: input.username ?? null,
      name: input.name ?? null,
      profilePictureUrl: input.profilePictureUrl ?? null,
      accountType: input.accountType ?? null,
    },
  });
}
