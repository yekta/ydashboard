import { env } from "@/lib/env";
import {
  cacheTimesSec,
  createCacheKeyForTRPCRoute,
  TCacheTime,
} from "@/server/redis/cache-utils";
import { Redis } from "ioredis";

const redis = new Redis(env.REDIS_URL + "?family=0");

export async function setCache(
  key: string,
  value: unknown,
  cacheTime: TCacheTime
) {
  const start = performance.now();
  try {
    await redis.set(key, JSON.stringify(value), "EX", cacheTimesSec[cacheTime]);
    const duration = Math.round(performance.now() - start);

    console.log(`[CACHE][SET]: "${key}" | ${duration}ms`);

    return true;
  } catch (error) {
    console.log(`[CACHE][ERROR]: Setting cache for "${key}"`, error);
  }
  return false;
}

export async function getCache<T>(key: string) {
  const start = performance.now();
  try {
    const value = await redis.get(key);
    const duration = Math.round(performance.now() - start);

    if (!value) {
      console.log(`[CACHE][MISS]: "${key}" | ${duration}ms`);
      return null;
    }

    console.log(`[CACHE][HIT]: "${key}" | ${duration}ms`);

    return JSON.parse(value) as T;
  } catch (error) {
    console.log(`[CACHE][ERROR]: Getting cache for "${key}"`, error);
  }
  return null;
}

export function cachedFunction<T>(
  func: () => Promise<T>,
  {
    path,
    params,
    cacheTime = "seconds-medium",
  }: {
    path: string;
    params: any;
    cacheTime: TCacheTime;
  }
) {
  return async () => {
    const key = createCacheKeyForTRPCRoute(path, params, cacheTime);
    const cache = await getCache<T>(key);
    if (cache) {
      return cache;
    }

    const result = await func();
    await setCache(key, result, cacheTime);
    return result;
  };
}
