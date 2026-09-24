export type InstagramClientConfig = {
  accessToken: string;
  apiVersion: string;
};

export type InstagramApiErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export type InstagramProfile = {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

export type InstagramComment = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  from?: {
    id?: string;
    username?: string;
  };
  hidden?: boolean;
  like_count?: number;
  parent_id?: string;
};

export type InstagramCommentsResponse = {
  data: InstagramComment[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
};

export type InstagramCommentReplyResponse = {
  id: string;
};

export type InstagramSendMessageResponse = {
  recipient_id?: string;
  message_id?: string;
};

export interface InstagramMediaChild {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  children?: {
    data: InstagramMediaChild[];
  };
}

export interface InstagramMediaListResponse {
  data: InstagramMedia[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

export interface InstagramMediaResponse extends InstagramMedia {
  username?: string;
}

/** Single insight metric from Graph API */
export type InstagramInsightMetric = {
  name: string;
  period?: string;
  values?: Array<{ value: number | Record<string, number>; end_time?: string }>;
  title?: string;
  description?: string;
  id?: string;
};

export type InstagramInsightsResponse = {
  data: InstagramInsightMetric[];
};
