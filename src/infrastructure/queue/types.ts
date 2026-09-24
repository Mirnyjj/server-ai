/** Queue names — keep stable; changing them creates new queues in Redis */
export const QUEUE_NAMES = {
  TOKEN_REFRESH: "token-refresh",
  WEBHOOK: "webhook",
  PUBLISH: "publish",
  CONTAINER_STATUS: "container-status",
  MEDIA_SYNC: "media-sync",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Job names within each queue */
export const JOB_NAMES = {
  // token-refresh
  REFRESH_CONNECTION: "refresh-connection",
  REFRESH_ALL_EXPIRING: "refresh-all-expiring",

  // webhook
  PROCESS_WEBHOOK_EVENT: "process-webhook-event",

  // publish
  PUBLISH_POST: "publish-post",
  CREATE_AND_PUBLISH: "create-and-publish",

  // container-status
  POLL_CONTAINER: "poll-container",

  // media-sync
  SYNC_ACCOUNT_MEDIA: "sync-account-media",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ─── Job payloads ───────────────────────────────────────────

export type RefreshConnectionJobData = {
  instagramAccountId: string;
};

export type RefreshAllExpiringJobData = {
  /** Refresh tokens that expire within this many hours (default 24) */
  withinHours?: number;
};

export type ProcessWebhookEventJobData = {
  webhookEventId: string;
};

export type PublishPostJobData = {
  postId: string;
  instagramUserId: string;
  containerId: string;
};

export type CreateAndPublishJobData = {
  postId: string;
  instagramUserId: string;
  /** One of image / reel / carousel / story */
  mediaType: "IMAGE" | "REEL" | "CAROUSEL" | "STORY" | "VIDEO";
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  altText?: string;
  isAiGenerated?: boolean;
  items?: Array<{ imageUrl?: string; videoUrl?: string }>;
};

export type PollContainerJobData = {
  postId: string;
  containerId: string;
  instagramUserId: string;
  /** Attempt counter (worker increments) */
  attempt?: number;
};

export type SyncAccountMediaJobData = {
  profileId: string;
};
