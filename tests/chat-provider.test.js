import assert from "node:assert/strict";
import test from "node:test";

import {
  chatProviderConfig,
  streamChatRequest,
  chatStreamDelta,
  chatStreamModel,
  chatStreamUsage,
} from "../lib/chat-provider.js";

test("chatProviderConfig resolves the MiniMax global region", () => {
  const cfg = chatProviderConfig({ CHAT_PROVIDER: "minimax", MINIMAX_REGION: "global_en" });
  assert.equal(cfg.provider, "minimax");
  assert.equal(cfg.baseUrl, "https://api.minimax.io/anthropic");
  assert.equal(cfg.model, "MiniMax-M3");
  assert.deepEqual(cfg.modelIds, ["MiniMax-M3", "MiniMax-M2.7"]);
});

test("chatProviderConfig resolves the MiniMax China region", () => {
  const cfg = chatProviderConfig({ CHAT_PROVIDER: "minimax", MINIMAX_REGION: "cn_zh" });
  assert.equal(cfg.baseUrl, "https://api.minimaxi.com/anthropic");
});

test("chatProviderConfig falls back to the global region on an unknown region", () => {
  const cfg = chatProviderConfig({ CHAT_PROVIDER: "minimax", MINIMAX_REGION: "mars" });
  assert.equal(cfg.baseUrl, "https://api.minimax.io/anthropic");
});

test("chatProviderConfig defaults to OpenRouter", () => {
  const cfg = chatProviderConfig({});
  assert.equal(cfg.provider, "openrouter");
  assert.equal(cfg.baseUrl, "https://openrouter.ai/api/v1");
  assert.deepEqual(cfg.modelIds, []);
});

test("chatProviderConfig lets MINIMAX_MODELS override the model list", () => {
  const cfg = chatProviderConfig({
    CHAT_PROVIDER: "minimax",
    MINIMAX_MODELS: "MiniMax-M2.7,MiniMax-M3",
  });
  assert.equal(cfg.model, "MiniMax-M2.7");
  assert.deepEqual(cfg.modelIds, ["MiniMax-M2.7", "MiniMax-M3"]);
});

function fakeStreamResponse() {
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => ({ done: true }) }) },
  };
}

test("streamChatRequest sends a MiniMax Anthropic Messages request", async () => {
  const captured = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured.url = url;
    captured.init = init;
    return fakeStreamResponse();
  };
  try {
    await streamChatRequest({
      provider: "minimax",
      baseUrl: "https://api.minimax.io/anthropic",
      apiKey: "test-key",
      model: "MiniMax-M3",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(captured.url, "https://api.minimax.io/anthropic/v1/messages");
  assert.equal(captured.init.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, "MiniMax-M3");
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 100);
});

test("streamChatRequest sends an OpenRouter chat completions request", async () => {
  const captured = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured.url = url;
    captured.init = init;
    return fakeStreamResponse();
  };
  try {
    await streamChatRequest({
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "or-key",
      model: "deepseek/deepseek-v4-flash",
      fallbackModels: ["google/gemini-3-flash-preview"],
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(captured.url, "https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(captured.init.body);
  assert.deepEqual(body.models, ["deepseek/deepseek-v4-flash", "google/gemini-3-flash-preview"]);
  assert.equal(body.stream, true);
  assert.equal(body.reasoning.enabled, false);
});

test("chatStreamDelta reads OpenRouter and MiniMax delta shapes", () => {
  assert.equal(
    chatStreamDelta({ choices: [{ delta: { content: "or" } }] }),
    "or",
  );
  assert.equal(
    chatStreamDelta({ delta: { text: "minimax" } }),
    "minimax",
  );
  assert.equal(chatStreamDelta({ other: true }), null);
});

test("chatStreamModel reads OpenRouter and MiniMax model shapes", () => {
  assert.equal(chatStreamModel({ model: "deepseek/deepseek-v4-flash" }), "deepseek/deepseek-v4-flash");
  assert.equal(chatStreamModel({ message: { model: "MiniMax-M3" } }), "MiniMax-M3");
  assert.equal(chatStreamModel({ other: true }), null);
});

test("chatStreamUsage reads the usage payload", () => {
  assert.deepEqual(chatStreamUsage({ usage: { prompt_tokens: 10 } }), { prompt_tokens: 10 });
  assert.equal(chatStreamUsage({ other: true }), null);
});
