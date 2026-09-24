import { prisma } from "../../../../prisma/prisma";
import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";
import type { InstagramComment } from "../client/instagram.types";

function mapCommentUsername(c: InstagramComment): string | null {
  return c.username ?? c.from?.username ?? null;
}

/**
 * Upsert a single comment from Graph API into Comment table.
 * Idempotent by instagramId.
 */
async function upsertCommentFromApi(
  postId: string,
  comment: InstagramComment,
) {
  const text = comment.text ?? "";
  const username = mapCommentUsername(comment);

  return prisma.comment.upsert({
    where: { instagramId: comment.id },
    create: {
      instagramId: comment.id,
      username,
      text,
      postId,
      replied: false,
      requiresHuman: false,
    },
    update: {
      text,
      username,
    },
  });
}

/**
 * Comment reconciliation (TZ §18).
 * Pulls comments from Graph API for published posts and upserts into DB.
 * Recovery mechanism when webhooks are missed or unavailable (local dev).
 */
export function createCommentReconciliationService(accessToken: string) {
  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  /**
   * Sync all comments for one post (by internal postId or instagramMediaId).
   * Paginates through Graph API until exhausted (or maxPages).
   */
  async function reconcilePostComments(input: {
    postId?: string;
    instagramMediaId?: string;
    maxPages?: number;
  }) {
    const maxPages = input.maxPages ?? 10;

    let post = input.postId
      ? await prisma.post.findUnique({ where: { id: input.postId } })
      : null;

    if (!post && input.instagramMediaId) {
      post = await prisma.post.findUnique({
        where: { instagramMediaId: input.instagramMediaId },
      });
    }

    if (!post) {
      throw new Error(
        `Post not found (postId=${input.postId}, mediaId=${input.instagramMediaId})`,
      );
    }

    if (!post.instagramMediaId) {
      throw new Error(`Post ${post.id} has no instagramMediaId`);
    }

    let after: string | undefined;
    let page = 0;
    let created = 0;
    let updated = 0;
    let fetched = 0;

    do {
      const response = await client.listComments(post.instagramMediaId, {
        after,
        limit: 50,
      });

      for (const comment of response.data ?? []) {
        fetched++;
        const existing = await prisma.comment.findUnique({
          where: { instagramId: comment.id },
        });

        await upsertCommentFromApi(post.id, comment);

        if (existing) {
          updated++;
        } else {
          created++;
        }
      }

      after = response.paging?.cursors?.after;
      page++;
    } while (after && page < maxPages);

    return {
      postId: post.id,
      instagramMediaId: post.instagramMediaId,
      fetched,
      created,
      updated,
      pages: page,
    };
  }

  /**
   * Reconcile comments for recent PUBLISHED posts of a profile.
   * Used as periodic recovery job.
   */
  async function reconcileProfileComments(input: {
    profileId: string;
    /** Max posts to process (default 20, newest first) */
    limit?: number;
    maxPagesPerPost?: number;
  }) {
    const limit = input.limit ?? 20;

    const posts = await prisma.post.findMany({
      where: {
        profileId: input.profileId,
        status: "PUBLISHED",
        instagramMediaId: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        instagramMediaId: true,
      },
    });

    const results: Array<{
      postId: string;
      ok: boolean;
      fetched?: number;
      created?: number;
      updated?: number;
      error?: string;
    }> = [];

    for (const post of posts) {
      try {
        const r = await reconcilePostComments({
          postId: post.id,
          maxPages: input.maxPagesPerPost ?? 5,
        });
        results.push({
          postId: post.id,
          ok: true,
          fetched: r.fetched,
          created: r.created,
          updated: r.updated,
        });
      } catch (error) {
        results.push({
          postId: post.id,
          ok: false,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return {
      profileId: input.profileId,
      postsProcessed: posts.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      totalCreated: results.reduce((s, r) => s + (r.created ?? 0), 0),
      totalUpdated: results.reduce((s, r) => s + (r.updated ?? 0), 0),
      results,
    };
  }

  return {
    reconcilePostComments,
    reconcileProfileComments,
  };
}
