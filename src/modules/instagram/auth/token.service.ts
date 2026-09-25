import {
  InstagramLongLivedTokenResponse,
  InstagramTokenResponse,
} from "./auth.types.js";

type ExchangeCodeInput = {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
};

type ExchangeTokenInput = {
  accessToken: string;
  appSecret: string;
};

type RefreshTokenInput = {
  accessToken: string;
};

export async function exchangeCodeForToken(
  input: ExchangeCodeInput,
): Promise<InstagramTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_message ?? "Failed to exchange Instagram authorization code",
    );
  }

  return data as InstagramTokenResponse;
}

export async function exchangeForLongLivedToken(
  input: ExchangeTokenInput,
): Promise<InstagramLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: input.appSecret,
    access_token: input.accessToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/access_token?${params.toString()}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? "Failed to exchange Instagram access token",
    );
  }

  return data as InstagramLongLivedTokenResponse;
}

export async function refreshLongLivedToken(
  input: RefreshTokenInput,
): Promise<InstagramLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: input.accessToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? "Failed to refresh Instagram access token",
    );
  }

  return data as InstagramLongLivedTokenResponse;
}
