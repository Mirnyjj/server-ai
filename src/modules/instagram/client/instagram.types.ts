export type InstagramClientConfig = {
  accessToken: string;
  apiVersion: string;
};

export type InstagramApiErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
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

export type InstagramMedia = {
  id: string;
};

export type InstagramMediaListResponse = {
  data: InstagramMedia[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
};

export type InstagramComment = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
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
