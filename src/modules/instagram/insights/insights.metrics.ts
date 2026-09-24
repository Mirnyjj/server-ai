/**
 * Default metric sets for Instagram Insights (TZ §26).
 * Not every metric is available for every media type — the API returns
 * only what is supported; unavailable metrics cause errors if requested.
 * We request conservative sets per media type.
 */

export const MEDIA_INSIGHTS_BY_TYPE: Record<string, string[]> = {
  // Feed image / carousel album
  IMAGE: [
    "impressions",
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "total_interactions",
  ],
  CAROUSEL_ALBUM: [
    "impressions",
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "total_interactions",
  ],
  // Video (feed)
  VIDEO: [
    "impressions",
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "plays",
    "total_interactions",
  ],
  // Reels
  REELS: [
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "plays",
    "total_interactions",
    "ig_reels_avg_watch_time",
    "ig_reels_video_view_total_time",
  ],
  // Stories — limited lifetime metrics
  STORY: ["impressions", "reach", "replies", "shares"],
  STORIES: ["impressions", "reach", "replies", "shares"],
};

/** Account-level lifetime/day metrics (TZ §28) */
export const ACCOUNT_INSIGHTS_METRICS = [
  "impressions",
  "reach",
  "follower_count",
  "profile_views",
  "website_clicks",
  "accounts_engaged",
  "total_interactions",
];

export function metricsForMediaType(mediaType: string): string[] {
  const key = mediaType.toUpperCase();
  return MEDIA_INSIGHTS_BY_TYPE[key] ?? MEDIA_INSIGHTS_BY_TYPE.IMAGE;
}
