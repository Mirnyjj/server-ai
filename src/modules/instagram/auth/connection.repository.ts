import { prisma } from "../../../../prisma/prisma.js";

type UpsertInstagramConnectionInput = {
  instagramAccountId: string;
  accessTokenEncrypted: string;
  tokenExpiresAt: Date;
  scopes: string[];
};

export async function upsertInstagramConnection(
  input: UpsertInstagramConnectionInput,
) {
  return prisma.instagramConnection.upsert({
    where: {
      instagramAccountId: input.instagramAccountId,
    },
    create: {
      instagramAccountId: input.instagramAccountId,
      accessTokenEncrypted: input.accessTokenEncrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes,
      status: "ACTIVE",
    },
    update: {
      accessTokenEncrypted: input.accessTokenEncrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes,
      status: "ACTIVE",
    },
  });
}

export async function findInstagramConnection(instagramAccountId: string) {
  return prisma.instagramConnection.findUnique({
    where: {
      instagramAccountId,
    },
  });
}

export async function updateInstagramConnectionToken(
  id: string,
  input: {
    accessTokenEncrypted: string;
    tokenExpiresAt: Date;
  },
) {
  return prisma.instagramConnection.update({
    where: {
      id,
    },
    data: {
      accessTokenEncrypted: input.accessTokenEncrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      status: "ACTIVE",
    },
  });
}
