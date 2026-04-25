/**
 * Shared Redis client helper for serverless functions.
 *
 * Uses node-redis with a cached singleton pattern. Each lambda container
 * pays the connection cost once on cold start, then reuses the connection
 * across warm invocations.
 *
 * Connection string is read from REDIS_URL environment variable.
 */

import { createClient } from "redis";

let cachedClient = null;

export async function getRedis() {
  if (cachedClient && cachedClient.isOpen) {
    return cachedClient;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable not set");
  }

  const client = createClient({
    url,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: false, // No retries in serverless — fail fast
    },
  });

  client.on("error", (err) => {
    console.error("Redis client error:", err.message);
  });

  await client.connect();
  cachedClient = client;
  return client;
}

/**
 * Get a value from Redis. JSON-decoded if it looks like JSON.
 * Returns null on error or missing key.
 */
export async function kvGet(key) {
  try {
    const client = await getRedis();
    const raw = await client.get(key);
    if (raw === null) return null;
    // Try JSON decode
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch (err) {
    console.error(`kvGet(${key}) error:`, err.message);
    return null;
  }
}

/**
 * Set a value in Redis. JSON-encodes objects automatically.
 * Optional TTL in seconds via { ex: N }.
 */
export async function kvSet(key, value, options = {}) {
  try {
    const client = await getRedis();
    const encoded = typeof value === "string" ? value : JSON.stringify(value);
    if (options.ex) {
      await client.set(key, encoded, { EX: options.ex });
    } else {
      await client.set(key, encoded);
    }
    return true;
  } catch (err) {
    console.error(`kvSet(${key}) error:`, err.message);
    return false;
  }
}

/**
 * Increment a counter in Redis. Returns the new value, or null on error.
 */
export async function kvIncr(key) {
  try {
    const client = await getRedis();
    return await client.incr(key);
  } catch (err) {
    console.error(`kvIncr(${key}) error:`, err.message);
    return null;
  }
}

/**
 * Set TTL (expiration) on a key in seconds.
 */
export async function kvExpire(key, seconds) {
  try {
    const client = await getRedis();
    await client.expire(key, seconds);
    return true;
  } catch (err) {
    console.error(`kvExpire(${key}) error:`, err.message);
    return false;
  }
}

/**
 * Set TTL only if the key has no TTL set (EXPIRE … NX). Idempotent —
 * safe to call on every increment without resetting the window.
 */
export async function kvExpireNx(key, seconds) {
  try {
    const client = await getRedis();
    await client.expire(key, seconds, "NX");
    return true;
  } catch (err) {
    console.error(`kvExpireNx(${key}) error:`, err.message);
    return false;
  }
}
