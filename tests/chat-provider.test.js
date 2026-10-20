import assert from "node:assert/strict";
import test from "node:test";
import {
  chatProviderConfig,
  streamChatRequest,
  chatStreamDelta,
  chatStreamModel,
  chatStreamUsage,
} from "../lib/chat-provider.js";

test("MiniMax defaults are Flash first and M3 only", () => {
  for (const MINIMAX_MODELS of [undefined, "", " , "]) {
    const cfg = chatProviderConfig({ CHAT_PROVIDER: "minimax", MINIMAX_MODELS });
    assert.equal(cfg.model, "MiniMax-M3.1-Flash");
    assert.deepEqual(cfg.modelIds, ["MiniMax-M3.1-Flash", "MiniMax-M3"]);
  }
  assert.equal(chatProviderConfig({ CHAT_PROVIDER: "minimax", MINIMAX_REGION: "mars" }).baseUrl,
    "https://api.minimax.io/anthropic");
});

test("MiniMax remains opt-in", () => {
  assert.equal(chatProviderConfig({}).provider, "gateway");
  assert.deepEqual(chatProviderConfig({}).modelIds, []);
});

for (const [region, host] of [["global_en", "api.minimax.io"], ["cn_zh", "api.minimax.cn"]]) {
  for (const override of [undefined, "MiniMax-M3", "MiniMax-M2.7,MiniMax-M3", "custom-model"]) {
    test(`serialized ${region} request preserves ${override || "default"}`, async (t) => {
      const cfg = chatProviderConfig({
        CHAT_PROVIDER: "minimax", MINIMAX_REGION: region, MINIMAX_MODELS: override,
      });
      const conversation = [
        { role: "user", content: [{ type: "image", source: { type: "url", url: "https://example.com/image.png" } }] },
        { role: "assistant", content: [
          { type: "thinking", thinking: "prior reasoning", signature: "fixture" },
          { type: "tool_use", id: "call_1", name: "lookup", input: { q: "Hermes" } },
        ] },
        { role: "user", content: [
          { type: "tool_result", tool_use_id: "call_1", content: "result" },
          { type: "video", source: { type: "url", url: "https://example.com/video.mp4" } },
        ] },
      ];
      const messages = [{ role: "system", content: "Instructions" }, ...conversation];
      const before = structuredClone(messages);
      let captured;
      t.mock.method(globalThis, "fetch", async (url, init) => {
        captured = { url, init, body: JSON.parse(init.body) };
        return new Response("");
      });
      const signal = new AbortController().signal;
      await streamChatRequest({ ...cfg, apiKey: "fixture-key", messages, maxTokens: 4096, signal });
      assert.equal(captured.url, `https://${host}/anthropic/v1/messages`);
      assert.equal(captured.init.headers.Authorization, "Bearer fixture-key");
      assert.equal(captured.init.signal, signal);
      assert.equal(captured.body.model, override?.split(",")[0] || "MiniMax-M3.1-Flash");
      assert.deepEqual(captured.body.system, [{ type: "text", text: "Instructions" }]);
      assert.deepEqual(captured.body.messages, conversation);
      assert.deepEqual(messages, before);
      assert.equal(captured.body.max_tokens, 4096);
      assert.equal(captured.body.stream, true);
      if (!override) {
        assert.deepEqual(captured.body.thinking, { type: "adaptive" });
        assert.deepEqual(captured.body.output_config, { effort: "low" });
      } else {
        assert.ok(!("thinking" in captured.body));
        assert.ok(!("output_config" in captured.body));
      }
      for (const unsupported of ["service_tier", "reasoning", "reasoning_split", "reasoning_effort"]) {
        assert.ok(!(unsupported in captured.body));
      }
    });
  }
}

test("stream readers preserve text and normalize split usage", () => {
  assert.equal(chatStreamDelta({ choices: [{ delta: { content: "answer" } }] }), "answer");
  assert.equal(chatStreamDelta({ delta: { type: "text_delta", text: "answer" } }), "answer");
  assert.equal(chatStreamDelta({ delta: { type: "thinking_delta", thinking: "private" } }), null);
  assert.equal(chatStreamModel({ message: { model: "MiniMax-M3.1-Flash" } }), "MiniMax-M3.1-Flash");
  assert.equal(chatStreamModel({ model: "custom" }), "custom");
  assert.deepEqual(chatStreamUsage({ message: { usage: { input_tokens: 10, output_tokens: 0 } } }),
    { prompt_tokens: 10, completion_tokens: 0 });
  assert.deepEqual(chatStreamUsage({ usage: { output_tokens: 20 } }), { completion_tokens: 20 });
  assert.deepEqual(chatStreamUsage({ usage: { prompt_tokens: 10, cost: 0.1 } }), { prompt_tokens: 10, cost: 0.1 });
  assert.equal(chatStreamUsage({}), null);
});
