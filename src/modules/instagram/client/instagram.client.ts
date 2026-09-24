import {
  InstagramContainerStatusResponse,
  InstagramMediaContainerResponse,
  InstagramPublishMediaResponse,
} from "../content/content.types";
import { createInstagramApiError } from "./instagram.errors";
import type {
  InstagramApiErrorResponse,
  InstagramClientConfig,
  InstagramCommentReplyResponse,
  InstagramCommentsResponse,
  InstagramInsightsResponse,
  InstagramMediaListResponse,
  InstagramMediaResponse,
  InstagramProfile,
  InstagramSendMessageResponse,
} from "./instagram.types";

export function createInstagramClient(config: InstagramClientConfig) {
  const baseUrl = `https://graph.instagram.com/${config.apiVersion}`;

  async function request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.accessToken}`,
        ...options.headers,
      },
    });

    const text = await response.text();

    let data: unknown;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const error = data as InstagramApiErrorResponse;

      throw createInstagramApiError(
        error.error?.message ?? "Instagram API request failed",
        response.status,
        error.error,
      );
    }

    return data as T;
  }

  async function getProfile(): Promise<InstagramProfile> {
    const params = new URLSearchParams({
      fields: [
        "user_id",
        "username",
        "name",
        "account_type",
        "profile_picture_url",
        "followers_count",
        "follows_count",
        "media_count",
      ].join(","),
    });

    return request<InstagramProfile>(`/me?${params.toString()}`);
  }

  async function listMedia(
    instagramUserId: string,
    options: { after?: string; limit?: number } = {},
  ): Promise<InstagramMediaListResponse> {
    const params = new URLSearchParams({
      fields: [
        "id",
        "caption",
        "media_type",
        "media_url",
        "thumbnail_url",
        "permalink",
        "timestamp",
        "children{id,media_type,media_url,thumbnail_url}",
      ].join(","),
    });

    if (options.after) {
      params.set("after", options.after);
    }

    if (options.limit) {
      params.set("limit", String(options.limit));
    }

    return request<InstagramMediaListResponse>(
      `/${instagramUserId}/media?${params.toString()}`,
    );
  }

  async function listComments(
    mediaId: string,
    options: { after?: string; limit?: number } = {},
  ): Promise<InstagramCommentsResponse> {
    const params = new URLSearchParams({
      fields: "id,text,timestamp,username,hidden,like_count,parent_id,from",
    });

    if (options.after) {
      params.set("after", options.after);
    }

    if (options.limit) {
      params.set("limit", String(options.limit));
    }

    return request<InstagramCommentsResponse>(
      `/${mediaId}/comments?${params.toString()}`,
    );
  }

  async function listCommentReplies(
    commentId: string,
  ): Promise<InstagramCommentsResponse> {
    const params = new URLSearchParams({
      fields: "id,text,timestamp,username,hidden,like_count,parent_id,from",
    });

    return request<InstagramCommentsResponse>(
      `/${commentId}/replies?${params.toString()}`,
    );
  }

  async function replyToComment(
    commentId: string,
    message: string,
  ): Promise<InstagramCommentReplyResponse> {
    return request<InstagramCommentReplyResponse>(`/${commentId}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    });
  }

  async function deleteComment(commentId: string): Promise<unknown> {
    return request<unknown>(`/${commentId}`, {
      method: "DELETE",
    });
  }

  async function createImageContainer(
    instagramUserId: string,
    imageUrl: string,
    caption?: string,
    altText?: string,
    isAiGenerated?: boolean,
  ): Promise<InstagramMediaContainerResponse> {
    const body: Record<string, unknown> = {
      image_url: imageUrl,
    };

    if (caption !== undefined) {
      body.caption = caption;
    }

    if (altText !== undefined) {
      body.alt_text = altText;
    }

    if (isAiGenerated !== undefined) {
      body.is_ai_generated = isAiGenerated;
    }

    return request<InstagramMediaContainerResponse>(
      `/${instagramUserId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }

  async function createVideoContainer(
    instagramUserId: string,
    videoUrl: string,
    caption?: string,
    isAiGenerated?: boolean,
  ): Promise<InstagramMediaContainerResponse> {
    const body: Record<string, unknown> = {
      video_url: videoUrl,
      media_type: "VIDEO",
    };

    if (caption !== undefined) {
      body.caption = caption;
    }

    if (isAiGenerated !== undefined) {
      body.is_ai_generated = isAiGenerated;
    }

    return request<InstagramMediaContainerResponse>(
      `/${instagramUserId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }

  async function createReelContainer(
    instagramUserId: string,
    videoUrl: string,
    caption?: string,
    isAiGenerated?: boolean,
  ): Promise<InstagramMediaContainerResponse> {
    const body: Record<string, unknown> = {
      video_url: videoUrl,
      media_type: "REELS",
    };

    if (caption !== undefined) {
      body.caption = caption;
    }

    if (isAiGenerated !== undefined) {
      body.is_ai_generated = isAiGenerated;
    }

    return request<InstagramMediaContainerResponse>(
      `/${instagramUserId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }

  async function createCarouselItemContainer(
    instagramUserId: string,
    item: {
      imageUrl?: string;
      videoUrl?: string;
    },
  ): Promise<InstagramMediaContainerResponse> {
    if (item.imageUrl && item.videoUrl) {
      throw new Error(
        "Carousel item cannot contain both imageUrl and videoUrl",
      );
    }

    if (!item.imageUrl && !item.videoUrl) {
      throw new Error("Carousel item requires imageUrl or videoUrl");
    }

    const body: Record<string, unknown> = {
      is_carousel_item: true,
    };

    if (item.imageUrl) {
      body.image_url = item.imageUrl;
    } else {
      body.video_url = item.videoUrl;
      body.media_type = "VIDEO";
    }

    return request<InstagramMediaContainerResponse>(
      `/${instagramUserId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }

  async function createCarouselContainer(
    instagramUserId: string,
    children: string[],
    caption?: string,
    isAiGenerated?: boolean,
  ): Promise<InstagramMediaContainerResponse> {
    if (children.length < 2) {
      throw new Error("Instagram carousel requires at least 2 children");
    }

    if (children.length > 10) {
      throw new Error("Instagram carousel supports up to 10 children");
    }

    const body: Record<string, unknown> = {
      media_type: "CAROUSEL",
      children: children.join(","),
    };

    if (caption !== undefined) {
      body.caption = caption;
    }

    if (isAiGenerated !== undefined) {
      body.is_ai_generated = isAiGenerated;
    }

    return request<InstagramMediaContainerResponse>(
      `/${instagramUserId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }

  async function getContainerStatus(
    containerId: string,
  ): Promise<InstagramContainerStatusResponse> {
    const params = new URLSearchParams({
      fields: "id,status_code",
    });

    return request<InstagramContainerStatusResponse>(
      `/${containerId}?${params.toString()}`,
    );
  }

  async function publishContainer(
    instagramUserId: string,
    containerId: string,
  ): Promise<InstagramPublishMediaResponse> {
    return request<InstagramPublishMediaResponse>(
      `/${instagramUserId}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creation_id: containerId,
        }),
      },
    );
  }

  async function createStoryContainer(
    instagramUserId: string,
    imageUrl?: string,
    videoUrl?: string,
    isAiGenerated?: boolean,
  ): Promise<InstagramMediaContainerResponse> {
    if (!imageUrl && !videoUrl) {
      throw new Error("Instagram Story requires imageUrl or videoUrl");
    }

    if (imageUrl && videoUrl) {
      throw new Error(
        "Instagram Story cannot contain both imageUrl and videoUrl",
      );
    }

    const body: Record<string, unknown> = {
      media_type: "STORIES",
    };

    if (imageUrl) {
      body.image_url = imageUrl;
    }

    if (videoUrl) {
      body.video_url = videoUrl;
    }

    if (isAiGenerated !== undefined) {
      body.is_ai_generated = isAiGenerated;
    }

    return request<InstagramMediaContainerResponse>(
      `/${instagramUserId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }

  async function sendMessage(
    instagramUserId: string,
    recipientId: string,
    message: string,
  ): Promise<InstagramSendMessageResponse> {
    return request<InstagramSendMessageResponse>(
      `/${instagramUserId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: {
            id: recipientId,
          },
          message: {
            text: message,
          },
        }),
      },
    );
  }

  async function subscribeToWebhooks(
    instagramUserId: string,
    subscribedFields: string[],
  ) {
    return request<{ success: boolean }>(
      `/${instagramUserId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: subscribedFields.join(","),
        }),
      },
    );
  }

  async function getMedia(mediaId: string) {
    const params = new URLSearchParams({
      fields: [
        "id",
        "caption",
        "media_type",
        "media_url",
        "thumbnail_url",
        "permalink",
        "timestamp",
        "username",
        "children{id,media_type,media_url,thumbnail_url}",
      ].join(","),
    });

    return request<InstagramMediaResponse>(`/${mediaId}?${params.toString()}`);
  }

  /**
   * Media insights (TZ §26).
   * Metric set depends on media type — unavailable metrics are omitted by API.
   * @see https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
   */
  async function getMediaInsights(
    mediaId: string,
    metrics: string[],
  ): Promise<InstagramInsightsResponse> {
    const params = new URLSearchParams({
      metric: metrics.join(","),
    });

    return request<InstagramInsightsResponse>(
      `/${mediaId}/insights?${params.toString()}`,
    );
  }

  /**
   * Account-level insights (TZ §28).
   * @see https://developers.facebook.com/docs/instagram-api/reference/ig-user/insights
   */
  async function getAccountInsights(
    instagramUserId: string,
    metrics: string[],
    options?: { period?: string; since?: number; until?: number },
  ): Promise<InstagramInsightsResponse> {
    const params = new URLSearchParams({
      metric: metrics.join(","),
      period: options?.period ?? "day",
    });

    if (options?.since) {
      params.set("since", String(options.since));
    }
    if (options?.until) {
      params.set("until", String(options.until));
    }

    return request<InstagramInsightsResponse>(
      `/${instagramUserId}/insights?${params.toString()}`,
    );
  }

  return {
    request,
    getProfile,
    listMedia,
    getMedia,

    listComments,
    listCommentReplies,
    replyToComment,
    deleteComment,

    createImageContainer,
    createVideoContainer,
    createReelContainer,
    createStoryContainer,
    createCarouselItemContainer,
    createCarouselContainer,

    getContainerStatus,
    publishContainer,

    sendMessage,

    subscribeToWebhooks,

    getMediaInsights,
    getAccountInsights,
  };
}
