import { env } from "../../../config/env";

type MetaPlatform = "instagram" | "facebook";

type RequestParams = Record<string, string | undefined>;

type MetaClientOptions = {
  accessToken: string;
  platform: MetaPlatform;
};

export function createMetaTestClient({
  accessToken,
  platform,
}: MetaClientOptions) {
  const baseUrl =
    platform === "instagram"
      ? "https://graph.instagram.com"
      : "https://graph.facebook.com";

  const apiVersion = env.INSTAGRAM_API_VERSION;

  async function request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    params: RequestParams = {},
  ): Promise<T> {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries({
      ...params,
      access_token: accessToken,
    })) {
      if (value !== undefined) {
        searchParams.set(key, value);
      }
    }

    const url = `${baseUrl}/${apiVersion}${path}?${searchParams.toString()}`;

    const response = await fetch(url, {
      method,
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(`Meta API ${response.status}: ${JSON.stringify(data)}`);
    }

    return data as T;
  }

  return {
    // =========================================================
    // PUBLIC PROFILE
    // =========================================================

    getInstagramMedia(instagramUserId: string) {
      return request(`/${instagramUserId}/media`, "GET", {
        fields: "id,caption,media_type,media_url,permalink,timestamp",
        limit: "10",
      });
    },

    // Instagram — insights

    getInstagramInsights(instagramUserId: string) {
      return request(`/${instagramUserId}/insights`, "GET", {
        metric: "impressions,reach,profile_views",
        period: "day",
      });
    },

    // Instagram — comments

    getInstagramMediaComments(mediaId: string) {
      return request(`/${mediaId}/comments`, "GET", {
        fields: "id,text,username,timestamp",
      });
    },

    // Instagram — content publishing

    createInstagramPhoto(
      instagramUserId: string,
      imageUrl: string,
      caption?: string,
    ) {
      return request(`/${instagramUserId}/media`, "POST", {
        image_url: imageUrl,
        caption,
      });
    },

    publishInstagramMedia(instagramUserId: string, creationId: string) {
      return request(`/${instagramUserId}/media_publish`, "POST", {
        creation_id: creationId,
      });
    },

    getMe() {
      return request("/me", "GET", {
        fields: "id,name",
      });
    },

    // =========================================================
    // PAGES
    // =========================================================

    getPages() {
      return request("/me/accounts", "GET", {
        fields: "id,name,access_token",
      });
    },

    getPage(pageId: string) {
      return request(`/${pageId}`, "GET", {
        fields: "id,name,instagram_business_account",
      });
    },

    getPagePosts(pageId: string) {
      return request(`/${pageId}/posts`, "GET", {
        fields: "id,message,created_time,permalink_url",
        limit: "10",
      });
    },

    getPageFeed(pageId: string) {
      return request(`/${pageId}/feed`, "GET", {
        fields: "id,message,created_time,permalink_url",
        limit: "10",
      });
    },

    // =========================================================
    // BUSINESS MANAGEMENT
    // =========================================================

    getBusinesses() {
      return request("/me/businesses", "GET", {
        fields: "id,name",
      });
    },

    getBusiness(businessId: string) {
      return request(`/${businessId}`, "GET", {
        fields: "id,name",
      });
    },

    getBusinessOwnedPages(businessId: string) {
      return request(`/${businessId}/owned_pages`, "GET", {
        fields: "id,name",
        limit: "10",
      });
    },

    getBusinessClientPages(businessId: string) {
      return request(`/${businessId}/client_pages`, "GET", {
        fields: "id,name",
        limit: "10",
      });
    },

    // =========================================================
    // BUSINESS ASSET USER PROFILE ACCESS
    // =========================================================

    getBusinessUsers(businessId: string) {
      return request(`/${businessId}/business_users`, "GET", {
        fields: "id,name,email,role",
        limit: "10",
      });
    },

    // =========================================================
    // INSTAGRAM
    // =========================================================

    getInstagramProfile(instagramUserId: string) {
      return request(`/${instagramUserId}`, "GET", {
        fields:
          "id,username,name,profile_picture_url,followers_count,media_count",
      });
    },

    getInstagramComments(mediaId: string) {
      return request(`/${mediaId}/comments`, "GET", {
        fields: "id,text,username,timestamp",
      });
    },

    getBusinessAssetUserProfile(userId: string) {
      return request(`/${userId}`, "GET", {
        fields: "id,name,picture",
      });
    },
  };
}
