export type InstagramTokenResponse = {
  access_token: string;
  user_id: string;
  permissions?: string;
};

export type InstagramLongLivedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type InstagramAuthResult = {
  instagramUserId: string;
  permissions: string[];
};
