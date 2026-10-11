import assert from "node:assert/strict";
import test from "node:test";

import {
  callLLM,
  callLLMJSON,
  chatRequestBody,
  PRIMARY_MODEL,
  FALLBACK_MODELS,
} from "../lib/llm.js";

function llmResponse(content) {
  return {
    ok: true,
    async json() {
      return { choices: [{ message: { content } }] };
    },
  };
}

test("callLLMJSON regenerates truncated JSON", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    llmResponse('{"summary":"truncated'),
    llmResponse('{"summary":"complete"}'),
  ];
  let calls = 0;
  globalThis.fetch = async () => responses[calls++];

  try {
    const result = await callLLMJSON({
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

test("callLLMJSON fails after bounded regeneration attempts", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return llmResponse('{"still":"truncated');
  };

  try {
    await assert.rejects(
      callLLMJSON({
        system: "system",
        user: "user",
        apiKey: "test",
        jsonRetryDelaysMs: [0, 0],
      }),
      /Failed to parse JSON from LLM response/,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function errorResponse(status, body = "upstream error") {
  return { ok: false, status, async text() { return body; } };
}

async function withFetch(impl, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("callLLM falls back to the next model client-side, one model per request", async () => {
  const sent = [];
  const result = await withFetch(
    async (_url, init) => {
      const body = JSON.parse(init.body);
      sent.push(body);
      return sent.length === 1 ? errorResponse(503) : llmResponse("from fallback");
    },
    () => callLLM({ system: "s", user: "u", apiKey: "test" }),
  );

  assert.equal(result, "from fallback");
  assert.deepEqual(sent.map((b) => b.model), [PRIMARY_MODEL, FALLBACK_MODELS[0]]);
  // The Portal rejects a `models` array ("Model parameter is required").
  assert.ok(sent.every((b) => !("models" in b)));
});

test("callLLM falls back when a model returns empty content", async () => {
  let calls = 0;
  const result = await withFetch(
    async () => (++calls === 1 ? llmResponse("") : llmResponse("second")),
    () => callLLM({ system: "s", user: "u", apiKey: "test" }),
  );
  assert.equal(result, "second");
  assert.equal(calls, 2);
});

test("callLLM fails loud on out-of-funds instead of masking it with a fallback", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      return errorResponse(402, "out of funds");
    },
    () =>
      assert.rejects(
        callLLM({ system: "s", user: "u", apiKey: "test" }),
        (err) => err.status === 402 && /out of funds/.test(err.message),
      ),
  );
  assert.equal(calls, 1);
});

test("chatRequestBody disables reasoning by default", () => {
  const body = chatRequestBody(PRIMARY_MODEL, { max_tokens: 100 });
  assert.deepEqual(body.reasoning, { enabled: false });
  assert.equal(body.max_tokens, 100);
});

test("chatRequestBody never disables reasoning on a reasoning-mandatory model", () => {
  const body = chatRequestBody("stepfun/step-5-preview", { max_tokens: 100 });
  // `enabled: false` is an HTTP 400 on this endpoint; exclude keeps the
  // thinking out of `content`, headroom keeps it from eating the budget.
  assert.deepEqual(body.reasoning, { effort: "low", exclude: true });
  assert.ok(body.max_tokens > 100);
});
