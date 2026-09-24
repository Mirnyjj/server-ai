import { Prisma } from "../../../generated/prisma/client";
import {
  MediaAssetStatus,
  MediaAssetType,
  PostMediaType,
  PostStatus,
  PostType,
} from "../../../generated/prisma/enums";
import { prisma } from "../../../../prisma/prisma";
import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";

export function createInstagramMediaService(accessToken: string) {
  const instagramClient = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  function mapInstagramMediaType(mediaType: string): PostType {
    switch (mediaType) {
      case "IMAGE":
        return PostType.PHOTO;

      case "VIDEO":
        return PostType.VIDEO;

      case "REELS":
        return PostType.REEL;

      case "CAROUSEL_ALBUM":
        return PostType.CAROUSEL;

      default:
        throw new Error(`Unsupported Instagram media type: ${mediaType}`);
    }
  }

  function mapAssetType(mediaType: string): MediaAssetType {
    switch (mediaType) {
      case "IMAGE":
        return MediaAssetType.IMAGE;

      case "VIDEO":
      case "REELS":
        return MediaAssetType.VIDEO;

      default:
        throw new Error(`Unsupported Instagram asset type: ${mediaType}`);
    }
  }

  function mapPostMediaType(mediaType: string): PostMediaType {
    switch (mediaType) {
      case "IMAGE":
        return PostMediaType.IMAGE;

      case "VIDEO":
      case "REELS":
        return PostMediaType.VIDEO;

      default:
        throw new Error(`Unsupported PostMedia type: ${mediaType}`);
    }
  }

  async function listMedia(
    instagramUserId: string,
    options?: {
      after?: string;
      limit?: number;
    },
  ) {
    return instagramClient.listMedia(instagramUserId, {
      after: options?.after,
      limit: options?.limit ?? 50,
    });
  }

  async function getMedia(mediaId: string) {
    return instagramClient.getMedia(mediaId);
  }

  async function syncAccount(profileId: string) {
    const aiProfile = await prisma.aiProfile.findUnique({
      where: {
        id: profileId,
      },
    });

    if (!aiProfile) {
      throw new Error(`AI profile ${profileId} not found`);
    }

    const instagramProfile = await instagramClient.getProfile();

    if (!instagramProfile.user_id) {
      throw new Error("Instagram API did not return user_id");
    }

    return prisma.instagramAccount.upsert({
      where: {
        instagramUserId: instagramProfile.user_id,
      },

      create: {
        instagramUserId: instagramProfile.user_id,
        username: instagramProfile.username ?? null,
        name: instagramProfile.name ?? null,
        accountType: instagramProfile.account_type ?? null,
        profilePictureUrl: instagramProfile.profile_picture_url ?? null,
        profileId: aiProfile.id,
        status: "ACTIVE",
      },

      update: {
        username: instagramProfile.username ?? null,
        name: instagramProfile.name ?? null,
        accountType: instagramProfile.account_type ?? null,
        profilePictureUrl: instagramProfile.profile_picture_url ?? null,
        profileId: aiProfile.id,
        status: "ACTIVE",
        lastError: null,
        lastErrorAt: null,
      },
    });
  }

  async function upsertMediaAsset(
    profileId: string,
    media: {
      id: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
    },
  ) {
    const mediaUrl = media.media_url ?? media.thumbnail_url;

    if (!mediaUrl) {
      return null;
    }

    const metadata = {
      instagramMediaId: media.id,
      thumbnailUrl: media.thumbnail_url ?? null,
    } satisfies Prisma.InputJsonValue;

    const existing = await prisma.mediaAsset.findUnique({
      where: {
        instagramMediaId: media.id,
      },
    });

    const asset = await prisma.mediaAsset.upsert({
      where: {
        instagramMediaId: media.id,
      },

      create: {
        instagramMediaId: media.id,
        profileId,
        type: mapAssetType(media.media_type),
        status: MediaAssetStatus.ACTIVE,

        // Для импортированного Instagram-контента
        // сохраняем URL Instagram.
        // storageKey остается null.
        url: mediaUrl,

        metadata,
      },

      update: {
        profileId,
        type: mapAssetType(media.media_type),
        status: MediaAssetStatus.ACTIVE,
        url: mediaUrl,
        metadata,
      },
    });

    return {
      asset,
      created: !existing,
    };
  }

  async function syncPostMedia(
    postId: string,
    profileId: string,
    media: {
      id: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
    },
    sortOrder: number,
  ) {
    const assetResult = await upsertMediaAsset(profileId, media);

    if (!assetResult) {
      return null;
    }

    const existingPostMedia = await prisma.postMedia.findFirst({
      where: {
        postId,
        mediaAssetId: assetResult.asset.id,
      },
    });

    if (existingPostMedia) {
      const postMedia = await prisma.postMedia.update({
        where: {
          id: existingPostMedia.id,
        },

        data: {
          type: mapPostMediaType(media.media_type),
          sortOrder,
          metadata: {
            instagramMediaId: media.id,
          },
        },
      });

      return {
        assetCreated: assetResult.created,
        postMediaCreated: false,
        postMedia,
      };
    }

    const postMedia = await prisma.postMedia.create({
      data: {
        postId,
        mediaAssetId: assetResult.asset.id,
        type: mapPostMediaType(media.media_type),
        sortOrder,
        metadata: {
          instagramMediaId: media.id,
        },
      },
    });

    return {
      assetCreated: assetResult.created,
      postMediaCreated: true,
      postMedia,
    };
  }

  async function syncPosts(profileId: string) {
    const account = await syncAccount(profileId);

    let after: string | undefined;

    let imported = 0;

    let createdPosts = 0;
    let updatedPosts = 0;

    let createdMediaAssets = 0;
    let updatedMediaAssets = 0;

    let createdPostMedia = 0;
    let updatedPostMedia = 0;

    do {
      const response = await instagramClient.listMedia(
        account.instagramUserId,
        {
          after,
          limit: 50,
        },
      );

      for (const media of response.data) {
        const existingPost = await prisma.post.findUnique({
          where: {
            instagramMediaId: media.id,
          },
        });

        const post = await prisma.post.upsert({
          where: {
            instagramMediaId: media.id,
          },

          create: {
            instagramMediaId: media.id,
            type: mapInstagramMediaType(media.media_type),
            status: PostStatus.PUBLISHED,
            caption: media.caption ?? null,
            publishedAt: media.timestamp ? new Date(media.timestamp) : null,
            profileId: account.profileId,
            accountId: account.id,
          },

          update: {
            type: mapInstagramMediaType(media.media_type),
            status: PostStatus.PUBLISHED,
            caption: media.caption ?? null,
            publishedAt: media.timestamp ? new Date(media.timestamp) : null,
            profileId: account.profileId,
            accountId: account.id,
          },
        });

        if (existingPost) {
          updatedPosts++;
        } else {
          createdPosts++;
        }

        /*
         * Для обычного поста:
         *   один Post -> один MediaAsset -> один PostMedia
         *
         * Для carousel:
         *   один Post -> несколько MediaAsset -> несколько PostMedia
         */
        const mediaItems =
          media.media_type === "CAROUSEL_ALBUM"
            ? (media.children?.data ?? [])
            : [
                {
                  id: media.id,
                  media_type: media.media_type,
                  media_url: media.media_url,
                  thumbnail_url: media.thumbnail_url,
                },
              ];

        for (const [index, mediaItem] of mediaItems.entries()) {
          const result = await syncPostMedia(
            post.id,
            account.profileId,
            mediaItem,
            index,
          );

          if (!result) {
            continue;
          }

          if (result.assetCreated) {
            createdMediaAssets++;
          } else {
            updatedMediaAssets++;
          }

          if (result.postMediaCreated) {
            createdPostMedia++;
          } else {
            updatedPostMedia++;
          }
        }

        imported++;
      }

      after = response.paging?.cursors?.after;
    } while (after);

    await prisma.instagramAccount.update({
      where: {
        id: account.id,
      },

      data: {
        lastSyncedAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });

    return {
      account,

      imported,

      createdPosts,
      updatedPosts,

      createdMediaAssets,
      updatedMediaAssets,

      createdPostMedia,
      updatedPostMedia,
    };
  }

  return {
    listMedia,
    getMedia,
    syncAccount,
    syncPosts,
  };
}
