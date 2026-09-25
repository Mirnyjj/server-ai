import "dotenv/config";

import { prisma } from "../prisma/prisma.js";
import { resolveAccessTokenByProfileId } from "../src/modules/instagram/auth/token.resolver.js";
import { createInstagramClient } from "../src/modules/instagram/client/instagram.client.js";
import { env, isOAuthEnabled } from "../src/config/env.js";

const profileId = process.env.IG_VERIFY_PROFILE_ID;
if (!profileId && !env.INSTAGRAM_MARKER) {
  throw new Error("IG_VERIFY_PROFILE_ID is required when INSTAGRAM_MARKER is not configured");
}

const account = profileId
  ? await prisma.instagramAccount.findFirst({
      where: { profileId, status: "ACTIVE" },
      include: { connection: true },
      orderBy: { updatedAt: "desc" },
    })
  : null;

if (profileId && !account && !env.INSTAGRAM_MARKER) {
  throw new Error(`No ACTIVE InstagramAccount for profile ${profileId}`);
}

if (account?.connection?.status !== "ACTIVE" && !env.INSTAGRAM_MARKER) {
  throw new Error(`Instagram connection for account ${account.id} is not ACTIVE`);
}

if (
  account?.connection?.tokenExpiresAt &&
  account.connection.tokenExpiresAt.getTime() <= Date.now()
) {
  throw new Error(
    `Instagram access token expired at ${account.connection.tokenExpiresAt.toISOString()}`,
  );
}

const accessToken = profileId
  ? await resolveAccessTokenByProfileId(profileId)
  : env.INSTAGRAM_MARKER!;

const client = createInstagramClient({
  accessToken,
  apiVersion: env.INSTAGRAM_API_VERSION,
});

const result: Record<string, unknown> = {
  profileId: profileId ?? null,
  instagramUserId: account?.instagramUserId ?? null,
  username: account?.username ?? null,
  apiVersion: env.INSTAGRAM_API_VERSION,
  oauthEnabled: isOAuthEnabled(),
  tokenSource: account?.connection?.status === "ACTIVE" ? "database" : "INSTAGRAM_MARKER",
  connectionStatus: account?.connection?.status ?? "MARKER",
  tokenExpiresAt: account?.connection?.tokenExpiresAt?.toISOString() ?? null,
};

console.log("[1/5] Token source: PASS");

const profile = await client.getProfile();
const instagramUserId = profile.user_id ?? profile.id;
if (!instagramUserId) {
  throw new Error("Instagram profile response has no user id");
}
if (account?.instagramUserId && profile.user_id && profile.user_id !== account.instagramUserId) {
  throw new Error(
    `DB Instagram user id ${account.instagramUserId} does not match API user id ${profile.user_id}`,
  );
}
result.profile = {
  id: profile.id ?? null,
  userId: profile.user_id ?? null,
  username: profile.username ?? null,
  accountType: profile.account_type ?? null,
  followers: profile.followers_count ?? null,
  mediaCount: profile.media_count ?? null,
};
console.log("[2/5] Profile API: PASS");

const media = await client.listMedia(instagramUserId, { limit: 5 });
result.media = {
  count: media.data.length,
  ids: media.data.map((item) => item.id),
};
console.log(`[3/5] Media API: PASS (${media.data.length} returned)`);

if (media.data[0]) {
  const comments = await client.listComments(media.data[0].id, { limit: 5 });
  result.comments = {
    mediaId: media.data[0].id,
    count: comments.data.length,
  };
  console.log(`[4/5] Comments API: PASS (${comments.data.length} returned)`);
} else {
  result.comments = { skipped: true, reason: "account has no media" };
  console.log("[4/5] Comments API: SKIP (account has no media)");
}

try {
  const insights = await client.getAccountInsights(
    instagramUserId,
    ["reach", "profile_views"],
    { period: "day" },
  );
  result.insights = {
    metrics: insights.data.map((metric) => metric.name),
  };
  console.log("[5/5] Account Insights API: PASS");
} catch (error) {
  result.insights = {
    error: error instanceof Error ? error.message : "unknown",
  };
  console.log("[5/5] Account Insights API: FAIL");
  if (!process.argv.includes("--write")) throw error;
}

if (process.argv.includes("--write")) {
  console.log("");
  console.log("WRITE CHECKS are intentionally not automated.");
  console.log(
    "Use the production account to manually test publish, comment reply, DM, and webhook delivery.",
  );
}

console.log("");
console.log("INSTAGRAM PRODUCTION READ CHECK: PASS");
console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();
