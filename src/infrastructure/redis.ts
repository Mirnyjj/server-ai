import Redis from "ioredis";
import { env } from "../config/env";

/**
 * Shared Redis connection for BullMQ and general caching.
 * BullMQ requires maxRetriesPerRequest: null on the connection.
 */
export function createRedisConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

/** Singleton connection used by queues and workers */
let sharedConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
