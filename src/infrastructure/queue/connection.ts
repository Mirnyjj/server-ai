import type { ConnectionOptions } from "bullmq";
import { env } from "../../config/env";

/**
 * BullMQ connection options derived from REDIS_URL.
 * Prefer URL form so password/host/port stay in one place.
 */
export function getBullMqConnection(): ConnectionOptions {
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  };
}

/** Default job options applied to all queues */
export const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 3000,
  },
  removeOnComplete: {
    age: 24 * 3600, // 24h
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // 7 days
  },
};
