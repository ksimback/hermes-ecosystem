/**
 * Shared OrcaRouter LLM call helper with retry.
 *
 * [OrcaRouter](https://www.orcarouter.ai) is an OpenAI-compatible model routing
 * gateway. It requires namespaced model IDs (`deepseek/deepseek-v4-flash`,
 * `openai/gpt-5.5`, ...) and takes a single `model` field — unlike the
 * OpenRouter helper, which sends a `models` fallback array with `route:
 * "fallback"`. Reasoning is disabled via `thinking: { type: "disabled" }` so
 * batch outputs land in `content`, not `reasoning_content` (a reasoning-capable
 * model such as deepseek-v4-flash otherwise burns its whole token budget on
 * hidden thinking and returns an empty `content`).
 *
 * Mirror of `lib/openrouter.js` used by the batch summary scripts when
 * `LLM_GATEWAY=orcarouter`.
 */
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

// Exponential backoff for transient failures: 1s, 2s, 4s between retries.
// Total max wait is ~7s — small enough not to balloon CI runtime, large
// enough to ride out a typical 429 burst or brief upstream blip.
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const JSON_RETRY_DELAYS_MS = [250, 750];

async function callOrcaRouterOnce({ system, user, apiKey, model, maxTokens }) {
  const res = await fetch("https://api.orcarouter.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
      thinking: { type: "disabled" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`OrcaRouter ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OrcaRouter");

  return content;
}

/**
 * Call OrcaRouter with retry on transient errors.
 *
 * Retries on 429 (rate limit), 5xx (server error), and network failures.
 * Does NOT retry on 4xx (bad request, missing key, etc.) — those are caller bugs.
 *
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User prompt
 * @param {string} options.apiKey - OrcaRouter API key
 * @param {string} [options.model] - Namespaced model ID (default: `deepseek/deepseek-v4-flash`)
 * @param {number} [options.maxTokens=800] - Max output tokens
 * @returns {Promise<string>} Raw response text
 */
export async function callOrcaRouter({
  system,
  user,
  apiKey,
  model = DEFAULT_MODEL,
  maxTokens = 800,
}) {
  if (!apiKey) throw new Error("OrcaRouter API key required");

  const args = { system, user, apiKey, model, maxTokens };

  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callOrcaRouterOnce(args);
    } catch (err) {
      lastError = err;

      // Retryable: HTTP 429, any 5xx, or no status (network/DNS/timeout).
      // Non-retryable: 4xx other than 429 (auth, malformed prompt, etc.).
      const isRetryable = !err.status || err.status === 429 || err.status >= 500;
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;

      if (!isRetryable || isLastAttempt) throw err;

      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `OrcaRouter ${err.status || "network error"} — retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError; // unreachable, but keeps TS/lints happy
}

/**
 * Call OrcaRouter and parse the response as JSON.
 * Strips markdown code fences if present.
 *
 * @param {Object} options - Same as callOrcaRouter
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function callOrcaRouterJSON({
  jsonRetryDelaysMs = JSON_RETRY_DELAYS_MS,
  ...options
}) {
  let lastError;
  for (let attempt = 0; attempt <= jsonRetryDelaysMs.length; attempt++) {
    const raw = await callOrcaRouter(options);

    // Strip markdown fences if the model wraps output in ```json ... ```
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      lastError = new Error(
        `Failed to parse JSON from OrcaRouter response: ${error.message}\nRaw: ${raw.slice(0, 300)}`
      );
      if (attempt === jsonRetryDelaysMs.length) throw lastError;

      const delay = jsonRetryDelaysMs[attempt];
      console.warn(
        `OrcaRouter returned invalid JSON — regenerating in ${delay}ms ` +
        `(attempt ${attempt + 2}/${jsonRetryDelaysMs.length + 1})`,
      );
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
