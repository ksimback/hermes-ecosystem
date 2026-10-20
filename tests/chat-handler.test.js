import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { registerHooks, syncBuiltinESMExports } from "node:module";

// Keep the real handler, config, serializer and SSE parser. Only external I/O
// (Redis, corpus reads and fetch) is mocked; no provider credentials are used.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/lib/redis.js")) {
      return {
        format: "module", shortCircuit: true,
        source: "export const kvIncr = async () => 1; export const kvIncrBy = async () => 1; export const kvExpireNx = async () => true;",
      };
    }
    return nextLoad(url, context);
  },
});

const cases = [
  { region: "global_en" },
  { region: "cn_zh" },
  { model: "MiniMax-M3" },
  { model: "MiniMax-M2.7" },
  { model: "custom-model" },
  { gateway: true },
  { gateway: true, fallback: true },
];

for (const [index, scenario] of cases.entries()) {
  test(`chat handler serializes ${JSON.stringify(scenario)}`, async (t) => {
    const envKeys = ["CHAT_PROVIDER", "MINIMAX_REGION", "MINIMAX_MODELS", "MINIMAX_API_KEY", "LLM_API_KEY", "CHAT_MODEL", "CHAT_FALLBACK_MODELS", "LLM_BASE_URL"];
    const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      CHAT_PROVIDER: scenario.gateway ? "" : "minimax",
      MINIMAX_REGION: scenario.region || "global_en",
      MINIMAX_MODELS: scenario.model || "",
      MINIMAX_API_KEY: "fixture-minimax",
      LLM_API_KEY: "fixture-gateway",
      CHAT_MODEL: "gateway-custom",
      CHAT_FALLBACK_MODELS: "gateway-fallback",
      LLM_BASE_URL: "https://gateway.example/v1",
    });
    t.after(() => {
      for (const key of envKeys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
      t.mock.restoreAll();
      syncBuiltinESMExports();
    });
    const originalRead = fs.readFileSync;
    t.mock.method(fs, "readFileSync", (path, ...args) => {
      if (String(path).endsWith("/data/chunks-meta.json")) {
        return JSON.stringify({ dimensions: 2, chunks: [
          { id: "fixture", text: "Hermes Agent uses skills.", source: "research/fixture.md", section: "Skills" },
        ] });
      }
      if (String(path).endsWith("/data/embeddings.bin")) return Buffer.from(new Float32Array([1, 0]).buffer);
      return originalRead(path, ...args);
    });
    syncBuiltinESMExports();
    const sent = [];
    let answerCalls = 0;
    t.mock.method(globalThis, "fetch", async (url, init) => {
      const body = JSON.parse(init.body);
      sent.push({ url, init, body });
      if (url.endsWith("/embeddings")) return Response.json({ data: [{ embedding: [1, 0] }] });
      if (!body.stream) return Response.json({ choices: [{ message: { content: "How do Hermes skills work?" } }] });
      answerCalls++;
      if (scenario.fallback && answerCalls === 1) return new Response("unavailable", { status: 503 });
      const events = scenario.gateway ? [
        { model: body.model, choices: [{ delta: { content: "Fixture answer" } }] },
        { usage: { prompt_tokens: 12, completion_tokens: 8 } },
      ] : [
        { type: "message_start", message: { model: body.model, usage: { input_tokens: 12, output_tokens: 0 } } },
        { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hidden reasoning" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "Fixture answer" } },
        { type: "message_delta", usage: { output_tokens: 8 } },
      ];
      return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
    });
    const { default: handler } = await import(`../api/chat.js?case=${index}`);
    const history = [{ role: "user", content: "Tell me about skills" }, { role: "assistant", content: "Skills are instructions." }];
    const response = {
      output: "", statusCode: 200, ended: false,
      on() {}, setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(value) { this.output = JSON.stringify(value); return this; },
      write(text) { this.output += text; },
      end() { this.ended = true; },
    };
    await handler({ method: "POST", headers: {}, body: { message: "How do Hermes skills work?", history } }, response);
    assert.equal(response.statusCode, 200);
    assert.ok(response.ended);
    assert.match(response.output, /Fixture answer/);
    assert.doesNotMatch(response.output, /hidden reasoning/);
    const requests = sent.filter(({ body }) => body.stream);
    assert.equal(requests.length, scenario.fallback ? 2 : 1);
    const answer = requests.at(-1);
    if (scenario.gateway) {
      assert.equal(answer.url, "https://gateway.example/v1/chat/completions");
      assert.equal(answer.body.model, scenario.fallback ? "gateway-fallback" : "gateway-custom");
      assert.deepEqual(answer.body.reasoning, { enabled: false });
      assert.equal(answer.body.messages[0].role, "system");
    } else {
      assert.equal(answer.url, `https://${scenario.region === "cn_zh" ? "api.minimax.cn" : "api.minimax.io"}/anthropic/v1/messages`);
      assert.equal(answer.init.headers.Authorization, "Bearer fixture-minimax");
      assert.equal(answer.body.model, scenario.model || "MiniMax-M3.1-Flash");
      assert.ok(answer.body.system[0].text.length > 100);
      assert.deepEqual(answer.body.messages.slice(0, 2), history);
      assert.ok(answer.body.messages.every((message) => message.role !== "system"));
      assert.equal(answer.body.thinking?.type, scenario.model ? undefined : "adaptive");
      assert.equal(answer.body.output_config?.effort, scenario.model ? undefined : "low");
      assert.ok(!("reasoning" in answer.body));
      assert.ok(!("service_tier" in answer.body));
    }
    const embedding = sent.find(({ url }) => url.endsWith("/embeddings"));
    assert.equal(embedding.url, "https://gateway.example/v1/embeddings");
    assert.equal(embedding.init.headers.Authorization, "Bearer fixture-gateway");
    const rewrite = sent.find(({ body }) => !body.stream && body.messages);
    assert.equal(rewrite.url, "https://gateway.example/v1/chat/completions");
    assert.equal(rewrite.init.headers.Authorization, "Bearer fixture-gateway");
  });
}

test.after(() => hooks.deregister());
