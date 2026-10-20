/** Direct MiniMax answer generation; the shared gateway remains the default. */
const MINIMAX_REGIONS = {
  global_en: "https://api.minimax.io/anthropic",
  cn_zh: "https://api.minimax.cn/anthropic",
};

export const MINIMAX_DEFAULT_MODELS = ["MiniMax-M3.1-Flash", "MiniMax-M3"];

/** Resolve defaults without replacing explicit custom or legacy model IDs. */
export function chatProviderConfig(env = process.env) {
  if ((env.CHAT_PROVIDER || "").trim().toLowerCase() !== "minimax") {
    return { provider: "gateway", baseUrl: "", model: "", modelIds: [] };
  }
  const region = (env.MINIMAX_REGION || "global_en").trim().toLowerCase();
  const configured = (env.MINIMAX_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const modelIds = configured.length ? configured : [...MINIMAX_DEFAULT_MODELS];
  return {
    provider: "minimax",
    baseUrl: MINIMAX_REGIONS[region] || MINIMAX_REGIONS.global_en,
    model: modelIds[0],
    modelIds,
  };
}

/** Serialize the Messages request at the fetch boundary. */
export async function streamChatRequest({
  baseUrl,
  apiKey,
  model,
  messages,
  maxTokens,
  signal,
}) {
  // Messages requires the system prompt outside the conversation array.
  // Preserve content blocks (including thinking/tool/image/video) unchanged.
  const system = messages.filter((m) => m.role === "system").flatMap((m) =>
    typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content
  );
  return fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model,
      ...(system.length ? { system } : {}),
      messages: messages.filter((m) => m.role !== "system"),
      max_tokens: maxTokens,
      stream: true,
      // Flash always thinks. Low effort leaves more of the answer budget for
      // text; M3 and explicit legacy/custom models retain their API defaults.
      ...(model === "MiniMax-M3.1-Flash"
        ? { thinking: { type: "adaptive" }, output_config: { effort: "low" } }
        : {}),
    }),
  });
}

/** Read answer text without forwarding thinking deltas to the chat UI. */
export function chatStreamDelta(parsed) {
  return parsed.choices?.[0]?.delta?.content ?? parsed.delta?.text ?? null;
}

export function chatStreamModel(parsed) {
  return parsed.model ?? parsed.message?.model ?? null;
}

/** Normalize split Messages usage to the existing chat counters. */
export function chatStreamUsage(parsed) {
  const usage = parsed.usage ?? parsed.message?.usage;
  if (!usage) return null;
  if (!("input_tokens" in usage || "output_tokens" in usage)) return usage;
  return {
    ...("input_tokens" in usage ? { prompt_tokens: usage.input_tokens } : {}),
    ...("output_tokens" in usage ? { completion_tokens: usage.output_tokens } : {}),
  };
}
