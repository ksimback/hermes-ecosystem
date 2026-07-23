import assert from "node:assert/strict";
import test from "node:test";

import { kvIncrBy } from "../lib/redis.js";

// kvIncrBy must be non-fatal: when Redis is unavailable it returns null rather
// than throwing. This is the contract the chat-usage observability relies on so
// a Redis hiccup can never break the user's response.
test("kvIncrBy returns null when Redis is unavailable", async () => {
  const original = process.env.REDIS_URL;
  delete process.env.REDIS_URL; // getRedis() throws → kvIncrBy swallows → null
  try {
    const result = await kvIncrBy("chat:tokens:test", 42);
    assert.equal(result, null);
  } finally {
    if (original !== undefined) process.env.REDIS_URL = original;
  }
});
