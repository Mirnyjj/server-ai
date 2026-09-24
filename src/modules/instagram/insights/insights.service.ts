import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../../prisma/prisma";
import { env } from "../../../config/env";
import { createInstagramClient } from "../client/instagram.client";
import type { InstagramInsightMetric } from "../client/instagram.types";
import {
  ACCOUNT_INSIGHTS_METRICS,
  metricsForMediaType,
} from "./insights.metrics";

function flattenInsights(
  data: InstagramInsightMetric[],
): Record<string, number | Record<string, number>> {
  const out: Record<string, number | Record<string, number>> = {};

  for (const metric of data) {
    const latest = metric.values?.[metric.values.length - 1];
    if (latest === undefined) continue;

    const value = latest.value;
    if (typeof value === "number") {
      out[metric.name] = value;
    } else if (value && typeof value === "object") {
      out[metric.name] = value as Record<string, number>;
    }
  }

  return out;
}

export function createInstagramInsightsService(accessToken: string) {
  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  /** Fetch insights for one IG media id (raw Graph response flattened) */
  async function fetchMediaInsights(
    instagramMediaId: string,
    mediaType?: string,
  ) {
    const metrics = metricsForMediaType(mediaType ?? "IMAGE");

    try {
      const response = await client.getMediaInsights(instagramMediaId, metrics);
      return {
        instagramMediaId,
        metrics: flattenInsights(response.data),
        raw: response.data,
      };
    } catch (error) {
      // Some metrics may not be available — retry with a minimal set
      const fallback = ["impressions", "reach", "likes", "comments"];
      try {
        const response = await client.getMediaInsights(
          instagramMediaId,
          fallback,
        );
        return {
          instagramMediaId,
          metrics: flattenInsights(response.data),
          raw: response.data,
          partial: true,
        };
      } catch {
        throw error;
      }
    }
  }

  /** Fetch + persist insights for a Post row */
  async function collectPostInsights(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (!post.instagramMediaId) {
      throw new Error(`Post ${postId} has no instagramMediaId — not published`);
    }

    if (post.status !== "PUBLISHED") {
      throw new Error(`Post ${postId} status is ${post.status}, expected PUBLISHED`);
    }

    const mediaType =
      post.type === "PHOTO"
        ? "IMAGE"
        : post.type === "REEL"
          ? "REELS"
          : post.type === "CAROUSEL"
            ? "CAROUSEL_ALBUM"
            : post.type === "STORY"
              ? "STORY"
              : "VIDEO";

    const result = await fetchMediaInsights(post.instagramMediaId, mediaType);

    const row = await prisma.postMetric.create({
      data: {
        postId: post.id,
        metrics: result.metrics as Prisma.InputJsonValue,
        recordedAt: new Date(),
      },
    });

    return {
      postId: post.id,
      instagramMediaId: post.instagramMediaId,
      metricId: row.id,
      metrics: result.metrics,
      partial: result.partial ?? false,
    };
  }

  /** Collect insights for all PUBLISHED posts of a profile */
  async function collectProfilePostInsights(profileId: string) {
    const posts = await prisma.post.findMany({
      where: {
        profileId,
        status: "PUBLISHED",
        instagramMediaId: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    const results: Array<{
      postId: string;
      ok: boolean;
      metrics?: Record<string, number | Record<string, number>>;
      error?: string;
    }> = [];

    for (const post of posts) {
      try {
        const r = await collectPostInsights(post.id);
        results.push({ postId: post.id, ok: true, metrics: r.metrics });
      } catch (error) {
        results.push({
          postId: post.id,
          ok: false,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return {
      profileId,
      total: posts.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  /** Account-level insights */
  async function fetchAccountInsights(
    instagramUserId: string,
    options?: { period?: string; since?: number; until?: number },
  ) {
    try {
      const response = await client.getAccountInsights(
        instagramUserId,
        ACCOUNT_INSIGHTS_METRICS,
        options,
      );
      return {
        instagramUserId,
        metrics: flattenInsights(response.data),
        raw: response.data,
      };
    } catch (error) {
      // Fallback to core metrics only
      const fallback = ["impressions", "reach", "profile_views"];
      const response = await client.getAccountInsights(
        instagramUserId,
        fallback,
        options,
      );
      return {
        instagramUserId,
        metrics: flattenInsights(response.data),
        raw: response.data,
        partial: true,
      };
    }
  }

  /** Latest stored metrics for a post */
  async function getStoredPostMetrics(postId: string, limit = 10) {
    return prisma.postMetric.findMany({
      where: { postId },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
  }

  return {
    fetchMediaInsights,
    collectPostInsights,
    collectProfilePostInsights,
    fetchAccountInsights,
    getStoredPostMetrics,
  };
}
