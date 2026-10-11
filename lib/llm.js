/**
 * Shared LLM provider config + call helpers (chat completions with a
 * client-side model fallback chain, and the embeddings endpoint URL).
 *
 * PROVIDER (2026-10-11): Nous Portal (https://portal.nousresearch.com), an
 * OpenAI-compatible gateway. Moved off OpenRouter after its key ran out of
 * credits and froze build-pages + rebuild-chunks for a week. The Portal
 * serves the same model IDs, and `openai/text-embedding-3-small` vectors are
 * identical to the ones in the committed chunk store (cosine 1.0 on sampled
 * chunks), so the embedding cache survives the move.
 *
 * Two Portal behaviors this file exists to absorb (both verified live):
 *   1. No server-side fallback. A body with only a `models` array is rejected
 *      ("Model parameter is required"), so the fallback loop lives here.
 *   2. Reasoning policy is per model — see reasoningFor().
 *
 * To point at another OpenAI-compatible gateway, set LLM_BASE_URL and
 * LLM_API_KEY. Never reuse a key across providers: the key is sent as a
 * bearer token to whatever LLM_BASE_URL names.
 */

export const LLM_BASE_URL = (
  process.env.LLM_BASE_URL || "https://inference-api.nousresearch.com/v1"
).replace(/\/+$/, "");
export const LLM_API_KEY = process.env.LLM_API_KEY || process.env.NOUS_API_KEY;
export const LLM_KEY_ENV_HINT = "NOUS_API_KEY";

export const CHAT_COMPLETIONS_URL = `${LLM_BASE_URL}/chat/completions`;
export const EMBEDDINGS_URL = `${LLM_BASE_URL}/embeddings`;

// One chain for chat, query rewriting, and batch summaries (decision
// 2026-10-11). The Portal has no free tier for the old gemma summaries
// waterfall, so the paid/free split that used to live here is gone.
export const PRIMARY_MODEL = "deepseek/deepseek-v4.1-flash";
export const FALLBACK_MODELS = ["stepfun/step-5-preview"];

// Models whose endpoint rejects `reasoning: { enabled: false }` with HTTP 400
// ("Reasoning is mandatory for this endpoint and cannot be disabled").
const REASONING_MANDATORY = new Set(["stepfun/step-5-preview"]);
// Hidden thinking is billed against max_tokens. Measured ~100-170 reasoning
// tokens per answer on step-5-preview at low effort; without headroom a small
// budget (the 100-token query rewrite) would be spent before any content.
const REASONING_HEADROOM_TOKENS = 512;

/**
 * Reasoning param for a model. Every caller reads ONLY message/delta
 * `content`, so reasoning must be either off or excluded from the response:
 *   - default: `enabled: false` stops the thinking entirely (not billed).
 *     LOAD-BEARING for deepseek flash models — without it they stream to
 *     `delta.reasoning` and clip or blank the answer.
 *   - reasoning-mandatory models: lowest effort + `exclude: true`, which
 *     keeps the thinking out of the response (it is still billed).
 */
export function reasoningFor(model) {
  return REASONING_MANDATORY.has(model)
    ? { effort: "low", exclude: true }
    : { enabled: false };
}

/** Build one model's request body: model + reasoning policy + token headroom. */
export function chatRequestBody(model, body) {
  const out = { ...body, model, reasoning: reasoningFor(model) };
  if (REASONING_MANDATORY.has(model) && typeof body.max_tokens === "number") {
    out.max_tokens = body.max_tokens + REASONING_HEADROOM_TOKENS;
  }
  return out;
}

/** POST one chat-completions request for one model. Returns the raw Response. */
export function fetchChatCompletion({ model, body, apiKey = LLM_API_KEY, signal }) {
  return fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chatRequestBody(model, body)),
  });
}

/**
 * Should a failed attempt move on to the next model in the chain?
 * 401/402/403 are account-level (bad key, out of funds) — every model would
 * fail the same way, so those surface immediately instead of being masked.
 */
export function shouldTryNextModel(status) {
  return ![401, 402, 403].includes(status);
}

// Exponential backoff for transient failures: 1s, 2s, 4s between retries.
// Total max wait is ~7s — small enough not to balloon CI runtime, large
// enough to ride out a typical 429 burst or brief upstream blip.
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const JSON_RETRY_DELAYS_MS = [250, 750];
// Per-request ceiling for batch calls. Without it a stalled connection sits on
// Node's 5-minute default per attempt (seen 2026-10-11: one list summary hung
// a local run for 7+ minutes across retries). A timeout has no HTTP status, so
// the retry loop below treats it like any other network failure.
const BATCH_REQUEST_TIMEOUT_MS = 120_000;

async function callLLMOnce({ system, user, apiKey, modelChain, maxTokens }) {
  let lastError;
  for (const model of modelChain) {
    const res = await fetchChatCompletion({
      model,
      apiKey,
      signal: AbortSignal.timeout(BATCH_REQUEST_TIMEOUT_MS),
      body: {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      lastError = new Error(`LLM ${res.status} (${model}): ${body.slice(0, 200)}`);
      lastError.status = res.status;
      if (!shouldTryNextModel(res.status)) throw lastError;
      continue;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return content;
    lastError = new Error(`Empty response from LLM (${model})`);
  }
  throw lastError;
}

/**
 * Call the LLM with automatic model fallback and retry on transient errors.
 *
 * Each attempt walks the model chain in order. The whole chain is retried on
 * 429 (rate limit), 5xx (server error), and network failures. NOT retried on
 * other 4xx (bad request, missing key, etc.) — those are caller bugs.
 *
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User prompt
 * @param {string} [options.apiKey] - Provider API key (default: LLM_API_KEY)
 * @param {string[]} [options.models] - Model fallback chain
 * @param {number} [options.maxTokens=800] - Max output tokens
 * @returns {Promise<string>} Raw response text
 */
export async function callLLM({
  system,
  user,
  apiKey = LLM_API_KEY,
  models,
  maxTokens = 800,
}) {
  if (!apiKey) throw new Error(`LLM API key required (${LLM_KEY_ENV_HINT})`);

  const modelChain = models || [PRIMARY_MODEL, ...FALLBACK_MODELS];
  const args = { system, user, apiKey, modelChain, maxTokens };

  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callLLMOnce(args);
    } catch (err) {
      lastError = err;

      // Retryable: HTTP 429, any 5xx, or no status (network/DNS/timeout).
      // Non-retryable: 4xx other than 429 (auth, malformed prompt, etc.).
      const isRetryable = !err.status || err.status === 429 || err.status >= 500;
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;

      if (!isRetryable || isLastAttempt) throw err;

      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `LLM ${err.status || "network error"} — retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError; // unreachable, but keeps TS/lints happy
}

/**
 * Call the LLM and parse the response as JSON.
 * Strips markdown code fences if present.
 *
 * @param {Object} options - Same as callLLM
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function callLLMJSON({
  jsonRetryDelaysMs = JSON_RETRY_DELAYS_MS,
  ...options
}) {
  let lastError;
  for (let attempt = 0; attempt <= jsonRetryDelaysMs.length; attempt++) {
    const raw = await callLLM(options);

    // Strip markdown fences if the model wraps output in ```json ... ```
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      lastError = new Error(
        `Failed to parse JSON from LLM response: ${error.message}\nRaw: ${raw.slice(0, 300)}`
      );
      if (attempt === jsonRetryDelaysMs.length) throw lastError;

      const delay = jsonRetryDelaysMs[attempt];
      console.warn(
        `LLM returned invalid JSON — regenerating in ${delay}ms ` +
        `(attempt ${attempt + 2}/${jsonRetryDelaysMs.length + 1})`,
      );
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
