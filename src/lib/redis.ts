/**
 * Shared Upstash Redis singleton.
 *
 * Every module that needs Redis imports getRedis() from here
 * instead of creating its own client. Returns null when
 * UPSTASH_REDIS_REST_URL is not set (local dev without Redis).
 */

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}
