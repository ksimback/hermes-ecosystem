/**
 * chat-provider.js — Chat LLM transport selection.
 *
 * The Atlas chatbot historically talked only to OpenRouter. This module adds a
 * direct MiniMax provider so the streaming chat completion can be served from
 * MiniMax's Anthropic Messages-compatible endpoint instead, without going
 * through OpenRouter. MiniMax exposes both an OpenAI-compatible endpoint and an
 * Anthropic Messages-compatible endpoint (`/anthropic`); we use the
 * Anthropic-compatible transport, which keeps the existing delta.content SSE
 * parser working.
 *
 * Two regional hosts are supported — the global host (api.minimax.io) and the
 * China host (api.minimaxi.com) — selectable via MINIMAX_REGION. The current
 * MiniMax text models (MiniMax-M3 and MiniMax-M2.7) are served from both
 * regions; the model list is configurable via MINIMAX_MODELS so new models can
 * be added without editing this file.
 */

// Regional endpoint pairs for the MiniMax Anthropic-compatible transport.
const MINIMAX_REGIONS = {
  global_en: {
    anthropic_base_url: "https://api.minimax.io/anthropic",
    openai_base_url: "https://api.minimax.io/v1",
    docs_root: "https://platform.minimax.io/docs",
  },
  cn_zh: {
    anthropic_base_url: "https://api.minimaxi.com/anthropic",
    openai_base_url: "https://api.minimaxi.com/v1",
    docs_root: "https://platform.minimaxi.com/docs",
  },
};

export const MINIMAX_DEFAULT_MODELS = ["MiniMax-M3", "MiniMax-M2.7"];

/**
 * Resolve the chat provider configuration from environment variables.
 *
 * @param {Object} env - Environment variables (defaults to process.env).
 * @returns {{provider:string,baseUrl:string,model:string,modelIds:string[]}}
 *   The resolved provider configuration. `baseUrl` is the API root for the
 *   selected transport; `model`/`modelIds` describe the MiniMax model list
 *   (empty for OpenRouter, which selects models elsewhere).
 */
export function chatProviderConfig(env = process.env) {
  const provider = (env.CHAT_PROVIDER || "openrouter").trim().toLowerCase();

  if (provider === "minimax") {
    const region = (env.MINIMAX_REGION || "global_en").trim().toLowerCase();
    const regionCfg = MINIMAX_REGIONS[region] || MINIMAX_REGIONS.global_en;
    const modelIds = (env.MINIMAX_MODELS || MINIMAX_DEFAULT_MODELS.join(","))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      provider: "minimax",
      baseUrl: regionCfg.anthropic_base_url,
      model: modelIds[0] || MINIMAX_DEFAULT_MODELS[0],
      modelIds,
    };
  }

  return {
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    modelIds: [],
  };
}

/**
 * Build and send the streaming chat request for the selected provider.
 *
 * The two transports are kept fully isolated — neither branch sees the other's
 * request shape — so a provider bug stays confined to its own branch.
 *
 * @param {Object} options
 * @param {string} options.provider - "openrouter" or "minimax"
 * @param {string} options.baseUrl - API root for the transport
 * @param {string} options.apiKey - Provider API key
 * @param {string} options.model - Primary model id
 * @param {string[]} [options.fallbackModels] - OpenRouter fallback chain (max 2 extra)
 * @param {Array} options.messages - Chat messages
 * @param {number} options.maxTokens - Max output tokens
 * @param {AbortSignal} [options.signal] - Abort signal for client disconnects
 * @returns {Promise<Response>} The upstream fetch response (streaming)
 */
export async function streamChatRequest({
  provider,
  baseUrl,
  apiKey,
  model,
  fallbackModels = [],
  messages,
  maxTokens,
  signal,
}) {
  if (provider === "minimax") {
    // MiniMax exposes an Anthropic Messages-compatible endpoint. The Anthropic
    // Messages API takes a single `model` (not a model array), so fallback is
    // handled client-side by the caller if desired. `max_tokens` is required by
    // the Anthropic Messages spec.
    return fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: true,
      }),
    });
  }

  // OpenRouter native fallback — pass ONLY `models` array (no `model` field);
  // it tries each in order until one succeeds. Cap at 3 total (provider limit).
  const models = [model, ...fallbackModels].slice(0, 3);
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://hermesatlas.com",
      "X-Title": "Hermes Atlas",
    },
    signal,
    body: JSON.stringify({
      ...(fallbackModels.length > 0 ? { models } : { model }),
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature: 0.3,
      usage: { include: true },
      // Force reasoning OFF. Our SSE parser reads only delta.content; a
      // reasoning-capable model streams to delta.reasoning (empty answer to us)
      // or burns the whole token budget on hidden thinking.
      reasoning: { enabled: false },
    }),
  });
}

/**
 * Extract a streamed text delta from a single SSE data payload, regardless of
 * provider. OpenRouter emits content as `choices[0].delta.content`; MiniMax
 * (Anthropic-compatible) emits it as `delta.text` on content_block_delta events.
 *
 * @param {Object} parsed - Parsed SSE payload
 * @returns {string|null} The text delta, or null if the payload carries none
 */
export function chatStreamDelta(parsed) {
  return parsed.choices?.[0]?.delta?.content ?? parsed.delta?.text ?? null;
}

/**
 * Extract the model id from a streamed SSE payload, regardless of provider.
 * OpenRouter reports `model` on every chunk; MiniMax reports `message.model`
 * on the `message_start` event.
 *
 * @param {Object} parsed - Parsed SSE payload
 * @returns {string|null} The model id, or null if the payload carries none
 */
export function chatStreamModel(parsed) {
  return parsed.model ?? parsed.message?.model ?? null;
}

/**
 * Extract token usage from a streamed SSE payload, regardless of provider.
 * OpenRouter emits `usage` on the final chunk; MiniMax emits it on the
 * `message_delta` event.
 *
 * @param {Object} parsed - Parsed SSE payload
 * @returns {Object|null} The usage object, or null if the payload carries none
 */
export function chatStreamUsage(parsed) {
  return parsed.usage ?? null;
}
