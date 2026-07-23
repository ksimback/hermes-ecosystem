# 🗺️ Hermes Atlas

**The community-curated map of every tool, skill, and integration for [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com).**

🌐 **Live site:** [hermesatlas.com](https://hermesatlas.com)

---

## What is this?

Hermes Atlas is a living directory of the Hermes Agent ecosystem. Hermes Agent (the self-improving AI agent from Nous Research) launched in February 2026 and immediately spawned a fast-growing community of skills, plugins, integrations, deployment templates, and forks. This site is the canonical map of all of it.

**Features:**
- **80+ quality-filtered repos** across 12 categories — every project security-reviewed before inclusion
- **Live star counts** fetched from the GitHub API and cached in Redis
- **Sparklines and trending badges** showing growth over time
- **RAG-powered chatbot** ("Ask the Atlas") that answers questions about Hermes Agent grounded in 27 research files
- **Search, sort, filter** across the entire ecosystem
- **Light and dark mode** with OS preference detection
- **Mobile responsive**

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│  hermesatlas.com (Vercel static + serverless)               │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ index.html  │  │ /api/stars   │  │ /api/chat        │    │
│  │ (the map)   │  │ (live data)  │  │ (RAG chatbot)    │    │
│  └─────────────┘  └──────┬───────┘  └────────┬─────────┘    │
│                          │                    │              │
│                          ▼                    ▼              │
│                   ┌──────────┐         ┌────────────┐       │
│                   │  Redis   │         │ OpenRouter │       │
│                   │  Cloud   │         │  (Gemma 4) │       │
│                   └────┬─────┘         └────────────┘       │
│                        │                                     │
│                        ▼                                     │
│                  ┌──────────┐                                │
│                  │ GitHub   │                                │
│                  │ GraphQL  │                                │
│                  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**Stack:**
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework, no build step)
- **Hosting:** Vercel (static + serverless functions)
- **Cache:** Redis Cloud (1hr TTL on star counts, daily history snapshots)
- **LLM:** OpenRouter with fallback chain (Gemma 4 31B → Gemma 4 26B → Gemini 3 Flash)
- **Embeddings:** OpenAI text-embedding-3-small (computed once at build time, cached as static JSON)
- **Retrieval:** Hybrid BM25 + cosine similarity, MMR re-ranking, conversation-aware query rewriting

## Repository structure

```
hermes/
├── index.html              # The map (single-page app)
├── api/
│   ├── stars.js            # GitHub star fetch + Redis cache
│   ├── stars-history.js    # 30-day history for sparklines
│   └── chat.js             # RAG pipeline with streaming
├── lib/
│   └── redis.js            # Shared Redis client helper
├── data/
│   ├── repos.json          # Quality-filtered repos (single source of truth)
│   ├── chunks-meta.json    # KB chunk text + metadata (see lib/chunk-store.js)
│   └── embeddings.bin      # Pre-computed embeddings (float32, ~14MB)
├── scripts/
│   ├── build-chunks.js     # Splits research/ into chunks + embeds them
│   └── test-rag.js         # Local RAG quality tests (27/27 passing)
├── research/               # 27 source-of-truth research files
├── repos/                  # Star count data, security review, raw search results
├── ECOSYSTEM.md            # Markdown version of the map
├── package.json            # Just two deps: openai, redis
└── vercel.json             # Function config + daily cron
```

## Running locally

```bash
git clone https://github.com/ksimback/hermes-ecosystem.git
cd hermes-ecosystem

# Install deps (only needed for the API endpoints + chunk builder)
npm install

# To rebuild the chatbot's knowledge base after editing research/ files:
OPENROUTER_API_KEY=sk-or-... node scripts/build-chunks.js

# To test the RAG pipeline locally:
OPENROUTER_API_KEY=sk-or-... node scripts/test-rag.js

# To preview the static site, just open index.html in a browser
# (the API endpoints only work when deployed to Vercel)
```

## Environment variables (Vercel)

| Variable | Purpose | Required |
|----------|---------|----------|
| `GITHUB_TOKEN` | Fine-grained PAT, public repos read-only | For 5000/hr rate limit (60/hr without) |
| `OPENROUTER_API_KEY` | LLM API key for chat | Yes |
| `REDIS_URL` | Redis Cloud connection string | Yes (for cache + history) |
| `OPENROUTER_MODEL` | Override primary LLM model | No (default: `google/gemini-3-flash-preview`) |
| `OPENROUTER_FALLBACK_MODELS` | Comma-separated fallback chain | No (default: `google/gemini-3.1-flash-lite-preview,mistralai/mistral-small-2603`) |

## Contributing

Found a Hermes Agent project that should be in the map? [Open an issue](https://github.com/ksimback/hermes-ecosystem/issues) with the GitHub URL. Filtering criteria:

- Must be specifically built for or integrated with Hermes Agent
- Created after July 22, 2025 (Hermes repo creation date)
- Not a personal pet project or assignment
- Shows genuine effort and adds value to the ecosystem
- Passes a basic security review

## License

Site code: MIT. Research content: CC BY 4.0. Repo descriptions and metadata are sourced from the upstream projects' own documentation.

---

Built by [@ksimback](https://github.com/ksimback). Not officially affiliated with Nous Research — community project celebrating their work.
