import { createClient, RedisClientType } from "redis";
import type { StorageAdapter } from "angelos";
import { config } from "./config.js";

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: config.redisUrl,
    });

    redisClient.on("error", (err) => {
      console.error("[Redis Client Error]:", err);
    });

    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Angelos StorageAdapter implementation backed by Redis.
 * Ensures atomic setIfAbsent using Redis NX and TTL expiration.
 */
export function createRedisStorageAdapter(client: RedisClientType): StorageAdapter {
  return {
    async get(key: string): Promise<string | null> {
      try {
        const val = await client.get(key);
        return val;
      } catch (error) {
        console.error(`[StorageAdapter.get] Error reading key ${key}:`, error);
        throw error;
      }
    },

    async setIfAbsent(key: string, value: string, expiresInSeconds: number): Promise<boolean> {
      try {
        // Redis SET with NX (not exists) and EX (expire in seconds)
        // Note: In angelos, the 3rd param is the TTL duration in seconds
        const result = await client.set(key, value, {
          NX: true,
          EX: expiresInSeconds,
        });
        return result === "OK";
      } catch (error) {
        console.error(`[StorageAdapter.setIfAbsent] Error setting key ${key}:`, error);
        throw error;
      }
    },

    async delete(key: string): Promise<boolean> {
      try {
        const count = await client.del(key);
        return count > 0;
      } catch (error) {
        console.error(`[StorageAdapter.delete] Error deleting key ${key}:`, error);
        throw error;
      }
    },
  };
}
