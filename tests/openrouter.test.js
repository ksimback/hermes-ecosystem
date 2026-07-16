import assert from "node:assert/strict";
import test from "node:test";

import { callOpenRouterJSON } from "../lib/openrouter.js";

function openRouterResponse(content) {
  return {
    ok: true,
    async json() {
      return { choices: [{ message: { content } }] };
    },
  };
}

test("callOpenRouterJSON regenerates truncated JSON", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    openRouterResponse('{"summary":"truncated'),
    openRouterResponse('{"summary":"complete"}'),
  ];
  let calls = 0;
  globalThis.fetch = async () => responses[calls++];

  try {
    const result = await callOpenRouterJSON({
      system: "system",
      user: "user",
      apiKey: "test",
      jsonRetryDelaysMs: [0, 0],
    });
    assert.deepEqual(result, { summary: "complete" });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callOpenRouterJSON fails after bounded regeneration attempts", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return openRouterResponse('{"still":"truncated');
  };

  try {
    await assert.rejects(
      callOpenRouterJSON({
        system: "system",
        user: "user",
        apiKey: "test",
        jsonRetryDelaysMs: [0, 0],
      }),
      /Failed to parse JSON from OpenRouter response/,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
