# The Hermes Handbook — Launch Playbook

Companion to `tasks/todo.md` Phase 6. This is the list of things **Kevin** has to do outside of code: outreach, tracking, and iteration.

Status as of 2026-04-20: hub + `/vs-claude-code/` satellite are live on disk, ready to ship.

---

## Ship checklist (before outreach)

- [ ] Preview locally (`python -m http.server 8000` → `/guide/` and `/guide/vs-claude-code/`)
- [ ] Merge to `main` via PR
- [ ] Verify Vercel deploy preview renders both pages + homepage banner rotation
- [ ] Verify sitemap reaches `https://hermesatlas.com/sitemap.xml` post-deploy
- [ ] **Re-run the RAG chunker** so the chatbot can answer from the guide:
  ```bash
  OPENROUTER_API_KEY=... node scripts/build-chunks.js
  ```
  Commit the updated `data/chunks.json` separately (expect ~20 new chunks, one per H2).
- [ ] **Submit to Google Search Console**: add `/guide/` and `/guide/vs-claude-code/` for priority indexing via the URL Inspection tool → "Request Indexing."
- [ ] **Test rich-result eligibility** — paste both URLs into [search.google.com/test/rich-results](https://search.google.com/test/rich-results) to confirm the `Article`, `HowTo`, and `FAQPage` schemas validate.
- [ ] **Design follow-up (deferred):** generate proper OG images at `/guide/assets/og-handbook.jpg` and `/guide/assets/og-vs-claude-code.jpg` (currently pointing at the generic `og-home.jpg` as placeholder).

---

## Outreach list (week 1)

Target: 8–12 touches in the first 72 hours after shipping. Don't batch-blast; space them out so signals look organic.

### Tier 1 — highest-leverage personal DMs

Send short, specific, no-ask DMs. The URL is the payload; one sentence of context around it.

| # | Who | Channel | Rationale |
|---|---|---|---|
| 1 | [@nickspisak_](https://x.com/nickspisak_) | X DM | Wrote "Hermes Agent Clearly Explained" — our handbook is a structured complement. Ask for a quote-retweet if he likes it. |
| 2 | [@Teknium1](https://x.com/Teknium1) (Nous co-founder) | X DM | Nous has no canonical beginner doc; we're filling a gap. Heads-up, not ask-for-retweet. |
| 3 | [@NousResearch](https://x.com/NousResearch) | X DM | Same as above — let them know before shipping. |
| 4 | [@robertscoble](https://x.com/Scobleizer) | X DM | Amplifies AI tools frequently; quoted Hermes in community intel report. |

### Tier 2 — community posts

| # | Where | Format | Rationale |
|---|---|---|---|
| 5 | Nous Research Discord → `#community-projects` | Post the guide with a 2-sentence intro | Core audience. Most likely to bookmark + share. |
| 6 | `r/LocalLLaMA` | Link post with a short comment explaining what's unique (ecosystem-linked) | High-signal community; has discussed Hermes multiple times. |
| 7 | Hacker News | `Show HN: The Hermes Handbook — beginner's guide with a community tool for every step` | Best shot at a front-page moment. Post Tuesday or Wednesday, 9am ET. |
| 8 | X main post | Thread (see snippet below) | Owned distribution, highest controllable quality. |

### Tier 3 — nice-to-have

| # | Where | Why |
|---|---|---|
| 9 | LinkedIn long-post | Slower-burn traffic; different audience (enterprise AI). |
| 10 | Indie Hackers | Small but engaged; our "built in public" story resonates. |
| 11 | Dev.to republish with canonical tag | Backlink value + indexed on a separate host; remember `rel="canonical"` → hermesatlas.com/guide/. |
| 12 | Email to any Nous Research contact | If you have one, keep it short. |

---

## Pre-written snippets

Edit freely — these are drafts.

### X thread (5 posts)

**Post 1 (hook):**
> Launched today: The Hermes Handbook — the complete beginner's guide to Nous Research's self-improving AI agent.
>
> The pitch: the only beginner's guide that also shows you the best community tool for every step. 93 quality-filtered projects behind it.
>
> https://hermesatlas.com/guide/

**Post 2 (differentiator):**
> Why it's different from the Nous docs + existing YouTube explainers:
>
> • Walks the path end-to-end (install → first workflow → learning loop)
> • Every concept links into the live ecosystem map
> • Updated monthly with fresh GitHub stats (currently 104,791 stars, growing fast)

**Post 3 (teaser for satellite):**
> Includes a satellite page that nobody else has done fairly: Hermes Agent vs Claude Code. Side-by-side 12-row table + an honest "run both" conclusion.
>
> https://hermesatlas.com/guide/vs-claude-code/

**Post 4 (feature):**
> The chapter that gets the most use on day 30: "The learning loop." Bounded memory (MEMORY.md 2.2KB, USER.md 1.4KB) isn't a limit — it's the feature.
>
> Why, and what it means for your first month with Hermes:
> https://hermesatlas.com/guide/#7-the-learning-loop

**Post 5 (close):**
> Feedback welcome. Broken? Wrong? Missing? Open an issue or DM me.
>
> → https://hermesatlas.com/guide/

### DM to Nick Spisak

> Hey Nick — just launched "The Hermes Handbook" on hermesatlas.com. It's the structured companion to your "Clearly Explained" post — 10 chapters, beginner path, linked into the 93 ecosystem projects I curate. Would love your take. https://hermesatlas.com/guide/

### Nous Discord post

> Shipped a beginner's guide to Hermes Agent on hermesatlas.com. Ten chapters from "what is it" through first workflow, learning loop, and essential skills — each section linked into the community ecosystem. Built to be the canonical starting point. Feedback and corrections very welcome.
>
> https://hermesatlas.com/guide/

### HN title + first comment

**Title:** `Show HN: The Hermes Handbook — beginner's guide to Nous Research's AI agent`

**First comment (self-posted):**
> Author here. I maintain hermesatlas.com, the ecosystem map for Hermes Agent. This handbook is the piece I kept wanting but couldn't find: a beginner's walkthrough that also tells you *which* community tool to reach for at each step. Happy to answer anything about Hermes, Nous, or the ecosystem.

### Reddit r/LocalLLaMA post

**Title:** `Wrote a beginner's guide to Hermes Agent — covers install, model pick, first workflow, and the learning loop`

**Body:**
> Hermes Agent is the Nous Research open-source agent that's passed 100K stars. I maintain the community ecosystem map at hermesatlas.com and kept getting asked "where do I start?" There was no single canonical beginner's doc, so I wrote one.
>
> 10 chapters, ~4,000 words, covers:
> - What Hermes actually is (30-sec + 2-min version)
> - Three user archetypes (CLI coder / automation operator / Telegram-bot operator)
> - How it differs from Claude Code, Cursor, OpenClaw
> - 2-minute install
> - Model selection (the first-weekend mistake that breaks most new setups)
> - Your first workflow (three worked examples)
> - The learning loop — bounded memory + auto-generated skills
> - Essential skills to install first
> - Where to go next
> - FAQ
>
> https://hermesatlas.com/guide/
>
> Feedback / corrections welcome. Will keep it updated monthly.

---

## Google Search Console tracking

### Queries to pin (for weekly review)

Set these up as saved queries / regex filters in GSC under **Performance → Search Queries**:

**Primary (hub):**
- `hermes agent`
- `hermes agent guide`
- `hermes agent tutorial`
- `hermes agent beginner`
- `how to use hermes agent`
- `what is hermes agent`
- `hermes agent getting started`

**Satellite #1:**
- `hermes agent vs claude code`
- `claude code vs hermes`
- `hermes vs claude code`

**Long-tail to watch (for future satellites):**
- `how to install hermes agent`
- `hermes agent telegram`
- `hermes agent skills`
- `best model for hermes agent`
- `hermes agent memory`
- `hermes agent ollama`

### Weekly metrics

Check every Monday morning for 4 weeks:

| Metric | Where in GSC | What's a good number week 1 | Week 4 |
|---|---|---|---|
| Impressions on `/guide/*` URLs | Performance → Pages | 500+ | 5,000+ |
| Avg. position | Performance → top queries | <50 | <20 |
| Clicks | Performance | 25+ | 250+ |
| Indexed pages | Coverage | 2 | 2 (both) |
| Rich results live | Enhancements | 0 (Google needs ~2 weeks to validate) | Article + FAQ |

Flag any page that lands in positions 11–20 — those are the pages one content tweak away from a first-page rank. Worth a satellite or expansion.

### Other tracking

- **Plausible / Fathom** — add a dashboard segment for `/guide/*` pageviews (first-click source, time on page, exit rate)
- **Twitter analytics** — watch the launch thread's impressions + link clicks; compare to the April report thread as baseline
- **GitHub stars on `ksimback/hermes-ecosystem`** — a proxy for people finding the Atlas via the handbook

---

## Post-launch decision gates

**Week 1:** did anything go viral? (HN front page, Nick/Teknium retweet, Reddit sticky)
- **Yes** → write satellite #2 (`/guide/install/`) this week to ride the wave
- **No** → sit tight; organic SEO will build; don't chase

**Week 2–3:** GSC impressions landing
- Which queries are we appearing for that we didn't target? Those are satellite opportunities.
- Which queries are we targeting but not appearing for? Those need the hub to go deeper, or a satellite to specialize.

**Week 4:** retro + write-up
- Update `tasks/todo.md` Phase 6 status
- Decide which of satellites #2–#4 to write next month (or if we need different ones)
- Schedule the monthly refresh (re-run GitHub stats, update stamps, fix any bit-rotted claims)

---

## If something goes wrong

- **Page 404s on deploy** — Vercel routing. Check `vercel.json` for `/guide/` → `guide/index.html` rewrite if trailing-slash URLs don't resolve.
- **Schema validation fails** — paste into [search.google.com/test/rich-results](https://search.google.com/test/rich-results), fix errors, redeploy.
- **Star number embarrassingly stale** — rerun the curl command in the handbook's footer stats section, re-stamp, redeploy.
- **Someone finds a factual error** — fix it in `drafts/handbook-hub.md`, regenerate the HTML manually (since we don't have a draft→HTML pipeline yet), commit.
