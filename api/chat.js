import { kvIncr, kvExpireNx } from "../lib/redis.js";
import { readFileSync } from "fs";
import { join } from "path";

// Load chunks at module level (cached across invocations in same lambda)
let chunks = null;
let bm25Index = null;
let reposData = null;

function loadChunks() {
  if (chunks) return chunks;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "chunks.json"), "utf-8");
    chunks = JSON.parse(raw);
    bm25Index = buildBM25Index(chunks);
    return chunks;
  } catch (e) {
    console.error("Failed to load chunks.json:", e.message);
    return [];
  }
}

function loadRepos() {
  if (reposData) return reposData;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "repos.json"), "utf-8");
    reposData = JSON.parse(raw);
    return reposData;
  } catch (e) {
    console.error("Failed to load repos.json:", e.message);
    return [];
  }
}

// Detect queries that benefit from repo metadata (rankings, comparisons, lists)
function isRepoMetadataQuery(query) {
  const lower = query.toLowerCase();
  const rankingTerms = [
    "best", "top", "most popular", "popular", "most starred", "highest",
    "ranked", "ranking", "leading", "biggest", "largest",
    "what are the", "list of", "which", "recommend", "compare",
    " vs ", "versus", "alternatives", "options",
  ];
  return rankingTerms.some(term => lower.includes(term));
}

// Build a compact, LLM-friendly summary of all repos sorted by stars
function buildRepoSummary(repos, category = null) {
  let filtered = repos;
  if (category) {
    filtered = repos.filter(r => r.category === category);
  }

  // Group by category, sort each group by stars desc
  const byCategory = {};
  for (const repo of filtered) {
    if (!byCategory[repo.category]) byCategory[repo.category] = [];
    byCategory[repo.category].push(repo);
  }

  let summary = "";
  for (const [cat, items] of Object.entries(byCategory)) {
    items.sort((a, b) => b.stars - a.stars);
    summary += `\n### ${cat}\n`;
    for (const r of items) {
      const officialTag = r.official ? " [OFFICIAL]" : "";
      summary += `- **${r.owner}/${r.repo}**${officialTag} (★ ${r.stars}) — ${r.description}\n`;
    }
  }
  return summary.trim();
}

// ── BM25 implementation ──
// Lightweight keyword search that complements vector search.
// Good at catching exact technical terms (CLI commands, repo names, version numbers).

// Tokenize: lowercase, split on non-alphanumeric, drop tiny tokens and stopwords.
const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","he","in","is","it",
  "its","of","on","that","the","to","was","were","will","with","you","your","i","me","my",
  "we","us","our","they","them","their","this","these","those","or","but","if","so","do",
  "does","did","can","how","what","when","where","why","which","who","whom","which"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

function buildBM25Index(chunks) {
  const N = chunks.length;
  const docFreq = new Map(); // term -> number of docs containing it
  const docs = [];

  let totalLen = 0;
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    docs.push({ tf, len: tokens.length });
    totalLen += tokens.length;
    for (const t of tf.keys()) docFreq.set(t, (docFreq.get(t) || 0) + 1);
  }
  const avgdl = totalLen / N;

  // Precompute IDF: log((N - df + 0.5) / (df + 0.5) + 1)
  const idf = new Map();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  return { docs, idf, avgdl, k1: 1.5, b: 0.75 };
}

function bm25Score(query, index) {
  const queryTokens = tokenize(query);
  const scores = new Array(index.docs.length).fill(0);

  for (const term of queryTokens) {
    const termIdf = index.idf.get(term);
    if (!termIdf) continue;

    for (let i = 0; i < index.docs.length; i++) {
      const doc = index.docs[i];
      const tf = doc.tf.get(term) || 0;
      if (tf === 0) continue;

      const norm = tf * (index.k1 + 1);
      const denom = tf + index.k1 * (1 - index.b + index.b * (doc.len / index.avgdl));
      scores[i] += termIdf * (norm / denom);
    }
  }

  return scores;
}

// Normalize scores to 0-1 range for combining with cosine similarity
function normalizeScores(scores) {
  let max = 0;
  for (const s of scores) if (s > max) max = s;
  if (max === 0) return scores;
  return scores.map(s => s / max);
}

// Maximal Marginal Relevance — picks chunks that are both relevant AND diverse.
// Prevents returning 8 near-duplicate paragraphs from the same section.
//
// Algorithm:
//   Given top-N candidates ranked by relevance, iteratively pick the chunk that
//   maximizes: λ × relevance − (1−λ) × max_similarity_to_already_selected
//
// λ = 1.0 → pure relevance (greedy top-K)
// λ = 0.0 → pure diversity
// λ = 0.5-0.7 → balanced (we use 0.6)
function mmrSelect(candidates, queryEmbedding, k, lambda = 0.6) {
  if (candidates.length <= k) return candidates;

  const selected = [];
  const remaining = [...candidates];

  // Always pick the top relevance chunk first
  selected.push(remaining.shift());

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance score (already in candidate.score from hybrid retrieval)
      const relevance = candidate.score;

      // Max similarity to any already-selected chunk
      let maxSim = 0;
      for (const sel of selected) {
        const sim = cosineSimilarity(candidate.embedding, sel.embedding);
        if (sim > maxSim) maxSim = sim;
      }

      // MMR score
      const mmr = lambda * relevance - (1 - lambda) * maxSim;

      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

// Model config — supports primary + fallback via OpenRouter's native routing.
// OpenRouter caps the models array at 3 total.
//
// IMPORTANT: Only use NON-REASONING models here. Reasoning models (GLM-4.7-Flash,
// Nemotron 3 Super) either stream to `delta.reasoning` instead of `delta.content`
// (returning empty content to our parser) or leak reasoning text into their
// content output.
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODELS = (process.env.OPENROUTER_FALLBACK_MODELS ||
  "google/gemma-4-26b-a4b-it:free," +
  "google/gemini-3-flash-preview"
).split(",").map(s => s.trim()).filter(Boolean).slice(0, 2);

const MAX_TOKENS = parseInt(process.env.CHAT_MAX_TOKENS || "800");

// Per-IP rate limits
const RATE_LIMIT_HOUR = parseInt(process.env.CHAT_RATE_LIMIT || "15"); // per hour per IP
const RATE_LIMIT_DAY = parseInt(process.env.CHAT_RATE_LIMIT_DAY || "50"); // per day per IP

// Global rate limit (all users combined)
const GLOBAL_LIMIT_HOUR = parseInt(process.env.CHAT_GLOBAL_LIMIT || "300"); // per hour site-wide
const GLOBAL_LIMIT_DAY = parseInt(process.env.CHAT_GLOBAL_LIMIT_DAY || "2000"); // per day site-wide

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: "Chat not configured — missing API key" });
  }

  // Reject oversized bodies before parsing further. Vercel's default body
  // limit is generous (~4.5MB); 256KB is more than enough for a chat turn
  // plus 20 history messages and stops obvious memory-exhaustion attempts.
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > 256 * 1024) {
    return res.status(413).json({ error: "Request too large" });
  }

  const { message, history = [] } = req.body || {};
  if (!message || typeof message !== "string" || message.length > 2000) {
    return res.status(400).json({ error: "Invalid message" });
  }

  // Cap history to bound prompt size (and OpenRouter cost). 20 messages
  // = 10 turns, plenty of context. Each message must also be a sane string.
  if (!Array.isArray(history) || history.length > 20) {
    return res.status(400).json({ error: "Invalid history" });
  }
  for (const m of history) {
    if (!m || typeof m.content !== "string" || m.content.length > 2000) {
      return res.status(400).json({ error: "Invalid history message" });
    }
  }

  // Rate limiting — per-IP (hour + day) and global (hour + day).
  // Use x-real-ip (set by Vercel's edge, not client-spoofable). Fall back
  // to x-forwarded-for only if missing (local dev). Avoid trusting raw
  // x-forwarded-for in production: clients can set it to anything and
  // bypass per-IP limits.
  const ip =
    req.headers["x-real-ip"]?.trim() ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown";
  const today = new Date().toISOString().slice(0, 10);

  const limits = [
    { key: `chat:ip:hour:${ip}`, max: RATE_LIMIT_HOUR, ttl: 3600, label: "per-hour", scope: "you" },
    { key: `chat:ip:day:${ip}:${today}`, max: RATE_LIMIT_DAY, ttl: 86400, label: "per-day", scope: "you" },
    { key: `chat:global:hour`, max: GLOBAL_LIMIT_HOUR, ttl: 3600, label: "per-hour", scope: "the site" },
    { key: `chat:global:day:${today}`, max: GLOBAL_LIMIT_DAY, ttl: 86400, label: "per-day", scope: "the site" },
  ];

  for (const { key, max, ttl, label, scope } of limits) {
    const count = await kvIncr(key);
    if (count === null) {
      // Redis unavailable — fail closed. Without a working counter we
      // cannot bound OpenRouter spend, and silently allowing requests
      // through is how a billing-bomb happens. Brief outages of chat
      // beat permanent overspend.
      return res.status(503).json({
        error: "Service temporarily unavailable. Please try again in a moment.",
      });
    }
    // EXPIRE NX is idempotent: sets TTL only if the key has none. This
    // prevents the prior race where if the first request's EXPIRE call
    // failed, the counter would persist forever without expiration.
    await kvExpireNx(key, ttl);
    if (count > max) {
      return res.status(429).json({
        error: `Rate limit reached (${max} ${label} for ${scope}). Try again later.`,
      });
    }
  }

  // Set streaming headers EARLY so client gets response immediately
  // This prevents Vercel from killing the connection during slow LLM responses
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  // Send immediate heartbeat (zero-width space) so connection is established
  // Client can now show "thinking" indicator
  res.write("\u200B");
  if (typeof res.flush === "function") res.flush();

  try {
    // 1. Load chunks (cached after first cold start)
    const allChunks = loadChunks();
    if (allChunks.length === 0) {
      res.write("Knowledge base not built yet. Please try again later.");
      return res.end();
    }

    // 2. Rewrite query using conversation history (if history exists)
    // This transforms "how do I install it?" → "how do I install Hermes Agent?"
    const searchQuery = history.length > 0
      ? await rewriteQuery(message, history)
      : message;

    console.log(`[RAG] Original: "${message}" → Search: "${searchQuery}"`);

    // 3. Embed the rewritten query
    const queryEmbedding = await getEmbedding(searchQuery);

    // 4. Hybrid search: combine BM25 (keyword) and cosine (semantic) scores
    // Normalize both to 0-1 then weighted sum: 0.7 vector + 0.3 keyword
    // Vector dominates for semantic understanding; BM25 boosts exact term matches.
    const cosineScores = allChunks.map(c => cosineSimilarity(queryEmbedding, c.embedding));
    const bm25Scores = bm25Index ? bm25Score(searchQuery, bm25Index) : cosineScores.map(() => 0);

    const normCosine = normalizeScores(cosineScores);
    const normBM25 = normalizeScores(bm25Scores);

    // Get top 20 candidates by hybrid score
    const candidates = allChunks
      .map((chunk, i) => ({
        ...chunk,
        score: 0.7 * normCosine[i] + 0.3 * normBM25[i],
        _cosine: cosineScores[i],
        _bm25: bm25Scores[i],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // 5. MMR re-ranking: pick 8 chunks that are both relevant AND diverse
    // Prevents returning 8 near-duplicate paragraphs from the same section
    const scored = mmrSelect(candidates, queryEmbedding, 8, 0.6);

    console.log(`[RAG] Top result: ${scored[0]?.source} (cos=${scored[0]?._cosine.toFixed(3)}, bm25=${scored[0]?._bm25.toFixed(3)}); ${new Set(scored.map(s => s.source)).size} unique sources`);

    // 6. Detect ranking/comparison queries and inject repo metadata
    // This gives the LLM live star counts to actually rank/compare repos
    const needsRepoData = isRepoMetadataQuery(searchQuery);
    let repoMetadataBlock = "";
    if (needsRepoData) {
      const repos = loadRepos();
      if (repos.length > 0) {
        repoMetadataBlock = `\n\n## REPO METADATA (sorted by stars within each category)\n${buildRepoSummary(repos)}\n`;
        console.log(`[RAG] Injected repo metadata (${repos.length} repos) for ranking query`);
      }
    }

    // 4. Build context: ALWAYS include baseline + retrieved chunks
    // This prevents vague queries from getting weak answers due to bad retrieval
    const baselineContext = `## CORE FACTS (always true)

Hermes Agent is an open-source autonomous AI agent developed by Nous Research, released in February 2026 under MIT license. It currently has 83,000+ stars on GitHub (v0.9.0 released April 13, 2026).

**What makes it unique:** Unlike stateless chatbots, Hermes has a built-in learning loop — it creates reusable skills from experience, remembers what it learns across sessions via persistent memory (MEMORY.md + USER.md + SQLite FTS5), and gets more capable the longer you use it. It's "the agent that grows with you."

**Core capabilities:**
- 47 built-in tools (terminal, files, browser, code execution, image gen, voice, etc.)
- 16 messaging platforms (Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Feishu, iMessage, WeChat, etc.)
- 20+ LLM providers (OpenRouter, Nous Portal, Anthropic, OpenAI, local via Ollama, etc.)
- 6 execution backends (local, Docker, SSH, Singularity, Modal, Daytona)
- Autonomous skill creation following agentskills.io standard
- Persistent cross-session memory with 8 pluggable memory providers

**Latest release (v0.9.0, April 13 2026):** Local web dashboard, Fast Mode (/fast) for GPT-5.4/Codex/Claude, iMessage via BlueBubbles, WeChat + WeCom native support, Termux/Android native, background process monitoring (watch_patterns), pluggable context engine, xAI (Grok) + Xiaomi MiMo + Qwen native providers, unified proxy support, 16 security fixes. 487 commits, 269 PRs, 24 contributors.

**Installation:** One-line install on Linux/macOS/WSL2:
\`curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash\`
Then run \`hermes\` to start. Only Git is required as a prerequisite — the installer handles Python, Node.js, ripgrep, and ffmpeg. Windows native not supported — use WSL2.

**Links:** https://github.com/NousResearch/hermes-agent | https://hermes-agent.nousresearch.com/docs`;

    const retrievedContext = scored
      .map(c => `[Source: ${c.source}${c.section ? `, Section: "${c.section}"` : ""}]\n${c.text}`)
      .join("\n\n---\n\n");

    // 5. Build messages for LLM
    const systemPrompt = `You are the Hermes Atlas assistant — the official chatbot of Hermes Atlas, a community-curated map of the Hermes Agent ecosystem. You help users understand Hermes Agent (by Nous Research) and its ecosystem — what it is, how to use it, tools, skills, plugins, comparisons, setup guides, and more.

ANSWER RULES:
- Start with a direct, complete answer. NEVER say "I don't have details" or "specific details are not in the context" when the CORE FACTS or RETRIEVED CONTEXT sections contain relevant information. Always synthesize what you DO have.
- Don't hedge with "based on the context" or "based on the available records."
- Use the CORE FACTS section as your baseline — those are always true. The "Latest release" line in CORE FACTS contains headline features that you MUST use when asked about the latest or newest release.
- Use the RETRIEVED CONTEXT section for specific details, recent updates, and tool recommendations.
- For ranking/comparison/recommendation questions, use the REPO METADATA section for accurate star counts.
- Cite sources from RETRIEVED CONTEXT using [Source: filename.md] format in brackets.
- For "what is" questions, give a proper 2-3 sentence overview first, THEN details.
- For "how do I" questions, give concrete steps with commands.
- For "what's new in vX.Y.Z" questions, list the major features with brief descriptions.
- Use bullet points for lists of tools, skills, or steps.
- ALWAYS mention exact star counts from REPO METADATA when comparing or recommending repos.
- If a question truly isn't covered by any of your sources, say so — but ONLY after checking CORE FACTS, RETRIEVED CONTEXT, and REPO METADATA. Do not give up prematurely.

${baselineContext}

## RETRIEVED CONTEXT (relevant to this specific question)

${retrievedContext}${repoMetadataBlock}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6).map(m => ({
        role: m.role,
        content: m.content.slice(0, 1000),
      })),
      { role: "user", content: message },
    ];

    // 6. Stream from LLM
    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hermesatlas.com",
        "X-Title": "Hermes Atlas",
      },
      body: JSON.stringify({
        // OpenRouter native fallback — pass ONLY `models` array (no `model` field)
        // It will try each in order until one succeeds
        ...(FALLBACK_MODELS.length > 0
          ? { models: [PRIMARY_MODEL, ...FALLBACK_MODELS] }
          : { model: PRIMARY_MODEL }),
        messages,
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error("LLM error:", err);
      let userMsg = "The AI service is temporarily unavailable. Please try again in a moment.";
      try {
        const parsed = JSON.parse(err);
        if (parsed.error?.code === 429) {
          userMsg = "All available AI models are rate-limited right now. Please try again in a minute.";
        } else if (parsed.error?.message) {
          userMsg = parsed.error.message;
        }
      } catch {}
      res.write(userMsg);
      return res.end();
    }

    const reader = llmRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let totalContent = "";
    let actualModel = null; // Captured from OpenRouter SSE chunks

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          // Check for errors embedded in the stream
          if (parsed.error) {
            console.error("Stream error:", parsed.error);
            if (totalContent.length === 0) {
              res.write("The model returned an error. Please try asking again.");
            }
            return res.end();
          }

          // Capture which model OpenRouter actually selected (after fallback routing)
          if (parsed.model && !actualModel) {
            actualModel = parsed.model;
          }

          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            totalContent += content;
            res.write(content);
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    // If the model returned nothing, tell the user
    if (totalContent.trim().length === 0) {
      res.write("The model returned an empty response. This sometimes happens with free models under load. Please try rephrasing or ask again.");
    }

    // Append model trailer at end of stream — client splits it off
    // Format: \u200E (LRM, invisible) + JSON + \u200E
    if (actualModel) {
      const trailer = `\u200E__META__${JSON.stringify({ model: actualModel })}__META__\u200E`;
      res.write(trailer);
    }

    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    // Headers are already sent, write error inline and end
    try {
      res.write("\n\n[Error: " + (err.message || "Internal error") + "]");
      res.end();
    } catch {}
  }
}

// Rewrite a follow-up question as a standalone query using conversation history.
// Uses few-shot examples for reliable pronoun resolution and context expansion.
async function rewriteQuery(message, history) {
  try {
    // Build a minimal history for the rewriter
    const historyText = history
      .slice(-4) // last 2 turns (user + assistant)
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const rewritePrompt = `Your job: rewrite follow-up questions into complete, standalone questions by resolving pronouns and adding implicit context from the conversation.

Rules:
- If the message uses pronouns like "it", "they", "this", "that" — replace them with the specific thing from the conversation.
- If the message is a fragment like "and for Telegram?" or "what about X?" — expand it into a full question.
- If the message is ALREADY a complete standalone question, return it EXACTLY as-is.
- Output ONLY the rewritten question. No preamble, no quotes, no explanation.
- Always prefer mentioning "Hermes Agent" explicitly if the question is about Hermes.

Examples:

History:
User: What is Hermes Agent?
Assistant: Hermes Agent is an open-source AI agent by Nous Research.
Latest: how do I install it?
Rewritten: How do I install Hermes Agent?

History:
User: Tell me about Hermes skills
Assistant: Skills are on-demand knowledge documents.
Latest: how do I create one?
Rewritten: How do I create a Hermes skill?

History:
User: What tools come with Hermes?
Assistant: Hermes has 47 built-in tools including terminal, browser, files, etc.
Latest: what are they?
Rewritten: What are the built-in tools in Hermes Agent?

History:
User: How do I set up the Discord integration in Hermes?
Assistant: Run hermes gateway setup and select Discord.
Latest: and for Telegram?
Rewritten: How do I set up the Telegram integration in Hermes?

History:
User: What memory providers does Hermes support?
Assistant: Hermes supports 8 providers including Honcho, Mem0, Supermemory, Hindsight.
Latest: which one is best?
Rewritten: Which memory provider is best for Hermes Agent?

History:
User: Hi
Assistant: Hello! How can I help?
Latest: What's the difference between Hermes Agent and OpenClaw?
Rewritten: What's the difference between Hermes Agent and OpenClaw?

Now rewrite this:

History:
${historyText}
Latest: ${message}
Rewritten:`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hermesatlas.com",
        "X-Title": "Hermes Atlas — Query Rewriter",
      },
      body: JSON.stringify({
        // Query rewriting needs fast, reliable, non-reasoning models with good
        // instruction following. Avoid reasoning models (GLM-4.7-Flash) which
        // put output in a 'reasoning' field and return null content.
        // All three options below are paid but cost fractions of a cent per call.
        models: [
          "google/gemini-3.1-flash-lite-preview",
          "qwen/qwen3.5-flash-02-23",
          "mistralai/mistral-small-2603",
        ],
        messages: [{ role: "user", content: rewritePrompt }],
        max_tokens: 100,
        temperature: 0,
        stop: ["\n\n", "History:", "Latest:"],
      }),
    });

    if (!res.ok) {
      console.warn("Query rewrite failed, using original");
      return message;
    }

    const data = await res.json();
    let rewritten = data.choices?.[0]?.message?.content?.trim();

    // Sanity checks: if rewrite is empty, too short, or way longer, fall back
    if (!rewritten || rewritten.length < 5 || rewritten.length > message.length * 10) {
      return message;
    }

    // Strip quotes if the model added them despite instructions
    rewritten = rewritten.replace(/^["'`]+|["'`]+$/g, "").trim();

    // Strip leading "Rewritten:" if the model echoed it
    rewritten = rewritten.replace(/^Rewritten:\s*/i, "").trim();

    // Take only first line (in case model added extra lines)
    rewritten = rewritten.split("\n")[0].trim();

    return rewritten || message;
  } catch (err) {
    console.warn("Query rewrite error:", err.message);
    return message; // Always fall back to the original on any failure
  }
}

async function getEmbedding(text) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: [text],
    }),
  });

  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    console.warn("[chat] cosine: zero-vector encountered, returning 0 (degrading to BM25-only ranking for this comparison)");
    return 0;
  }
  return dot / denom;
}
