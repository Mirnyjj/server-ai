export const QUEUE_NAMES = {
  TOKEN_REFRESH: "token-refresh",
  WEBHOOK: "webhook",
  PUBLISH: "publish",
  CONTAINER_STATUS: "container-status",
  MEDIA_SYNC: "media-sync",
  INSIGHTS: "insights",
  COMMENT_RECONCILE: "comment-reconcile",
  AGENT: "agent",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  REFRESH_CONNECTION: "refresh-connection",
  REFRESH_ALL_EXPIRING: "refresh-all-expiring",

  PROCESS_WEBHOOK_EVENT: "process-webhook-event",

  PUBLISH_POST: "publish-post",
  CREATE_AND_PUBLISH: "create-and-publish",

  POLL_CONTAINER: "poll-container",

  SYNC_ACCOUNT_MEDIA: "sync-account-media",

  COLLECT_PROFILE_INSIGHTS: "collect-profile-insights",
  COLLECT_POST_INSIGHTS: "collect-post-insights",

  RECONCILE_PROFILE_COMMENTS: "reconcile-profile-comments",
  RECONCILE_POST_COMMENTS: "reconcile-post-comments",

  PROCESS_COMMENT: "process-comment",
  PROCESS_DIRECT_MESSAGE: "process-direct-message",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export type RefreshConnectionJobData = {
  instagramAccountId: string;
};

export type RefreshAllExpiringJobData = {
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
  attempt?: number;
};

export type SyncAccountMediaJobData = {
  profileId: string;
};

export type CollectProfileInsightsJobData = {
  profileId: string;
};

export type CollectPostInsightsJobData = {
  postId: string;
};

export type ReconcileProfileCommentsJobData = {
  profileId: string;
  limit?: number;
};

export type ReconcilePostCommentsJobData = {
  postId?: string;
  instagramMediaId?: string;
};

export type ProcessCommentJobData = {
  commentId: string;
};

export type ProcessDirectMessageJobData = {
  messageId: string;
};
