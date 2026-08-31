import assert from "node:assert/strict";
import test from "node:test";

import { callOrcaRouterJSON, callOrcaRouter } from "../lib/orcarouter.js";

function orcaRouterResponse(content) {
  return {
    ok: true,
    async json() {
      return { choices: [{ message: { content } }] };
    },
  };
}

test("callOrcaRouterJSON regenerates truncated JSON", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    orcaRouterResponse('{"summary":"truncated'),
    orcaRouterResponse('{"summary":"complete"}'),
  ];
  let calls = 0;
  globalThis.fetch = async () => responses[calls++];

  try {
    const result = await callOrcaRouterJSON({
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

test("callOrcaRouterJSON fails after bounded regeneration attempts", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return orcaRouterResponse('{"still":"truncated');
  };

  try {
    await assert.rejects(
      callOrcaRouterJSON({
        system: "system",
        user: "user",
        apiKey: "test",
        jsonRetryDelaysMs: [0, 0],
      }),
      /Failed to parse JSON from OrcaRouter response/,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callOrcaRouter posts a single namespaced model with reasoning disabled", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl;
  let capturedHeaders;
  let capturedBody;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    capturedBody = JSON.parse(init.body);
    return orcaRouterResponse("ok");
  };

  try {
    const result = await callOrcaRouter({
      system: "system",
      user: "user",
      apiKey: "sk-orca-test",
      model: "deepseek/deepseek-v4-flash",
      maxTokens: 300,
    });
    assert.equal(result, "ok");
    assert.equal(capturedUrl, "https://api.orcarouter.ai/v1/chat/completions");
    assert.equal(capturedHeaders.Authorization, "Bearer sk-orca-test");
    // No OpenRouter attribution headers on the OrcaRouter path.
    assert.equal(capturedHeaders["HTTP-Referer"], undefined);
    assert.equal(capturedHeaders["X-Title"], undefined);
    // Single `model` field (not OpenRouter's `models` fallback array), namespaced,
    // and reasoning disabled so content is not diverted to reasoning_content.
    assert.equal(capturedBody.model, "deepseek/deepseek-v4-flash");
    assert.equal(capturedBody.models, undefined);
    assert.deepEqual(capturedBody.thinking, { type: "disabled" });
    assert.equal(capturedBody.max_tokens, 300);
    assert.equal(capturedBody.temperature, 0.3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callOrcaRouter defaults to a namespaced model", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody;
  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return orcaRouterResponse("ok");
  };

  try {
    await callOrcaRouter({ system: "system", user: "user", apiKey: "sk-orca-test" });
    // Default must be a namespaced ID — OrcaRouter rejects bare model names.
    assert.match(capturedBody.model, /\//);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
