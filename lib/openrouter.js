/**
 * Shared OpenRouter LLM call helper with model fallback chain.
 */

const PRIMARY_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemini-3-flash-preview",
];

// Exponential backoff for transient failures: 1s, 2s, 4s between retries.
// Total max wait is ~7s — small enough not to balloon CI runtime, large
// enough to ride out a typical 429 burst or brief upstream blip.
const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function callOpenRouterOnce({ system, user, apiKey, modelChain, maxTokens }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://hermesatlas.com",
      "X-Title": "Hermes Atlas",
    },
    body: JSON.stringify({
      models: modelChain.slice(0, 3),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
      route: "fallback",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");

  return content;
}

/**
 * Call OpenRouter with automatic model fallback and retry on transient errors.
 *
 * Retries on 429 (rate limit), 5xx (server error), and network failures.
 * Does NOT retry on 4xx (bad request, missing key, etc.) — those are caller bugs.
 *
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User prompt
 * @param {string} options.apiKey - OpenRouter API key
 * @param {string[]} [options.models] - Model fallback chain (max 3)
 * @param {number} [options.maxTokens=800] - Max output tokens
 * @returns {Promise<string>} Raw response text
 */
export async function callOpenRouter({
  system,
  user,
  apiKey,
  models,
  maxTokens = 800,
}) {
  if (!apiKey) throw new Error("OpenRouter API key required");

  const modelChain = models || [PRIMARY_MODEL, ...FALLBACK_MODELS];
  const args = { system, user, apiKey, modelChain, maxTokens };

  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callOpenRouterOnce(args);
    } catch (err) {
      lastError = err;

      // Retryable: HTTP 429, any 5xx, or no status (network/DNS/timeout).
      // Non-retryable: 4xx other than 429 (auth, malformed prompt, etc.).
      const isRetryable = !err.status || err.status === 429 || err.status >= 500;
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;

      if (!isRetryable || isLastAttempt) throw err;

      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `OpenRouter ${err.status || "network error"} — retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError; // unreachable, but keeps TS/lints happy
}

/**
 * Call OpenRouter and parse the response as JSON.
 * Strips markdown code fences if present.
 *
 * @param {Object} options - Same as callOpenRouter
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function callOpenRouterJSON(options) {
  const raw = await callOpenRouter(options);

  // Strip markdown fences if the model wraps output in ```json ... ```
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from OpenRouter response: ${e.message}\nRaw: ${raw.slice(0, 300)}`
    );
  }
}
