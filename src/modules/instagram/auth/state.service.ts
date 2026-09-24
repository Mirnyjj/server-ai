import crypto from "node:crypto";
import Redis from "ioredis";
import { env } from "../../../config/env";

const redis = new Redis(env.REDIS_URL);

const STATE_PREFIX = "instagram:oauth:state";

export async function createOAuthState(profileId: string): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");

  await redis.set(
    `${STATE_PREFIX}:${state}`,
    profileId,
    "EX",
    env.OAUTH_STATE_TTL_SECONDS,
  );

  return state;
}

export async function consumeOAuthState(state: string): Promise<string | null> {
  const key = `${STATE_PREFIX}:${state}`;

  const result = await redis.eval(
    `
      local value = redis.call("GET", KEYS[1])

      if not value then
        return false
      end

      redis.call("DEL", KEYS[1])
      return value
    `,
    1,
    key,
  );

  if (!result || result === false) {
    return null;
  }

  return String(result);
}
