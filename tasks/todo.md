# Hermes Atlas v2 — Execution Plan

**Status:** v2 shipped 2026-04-18 (PR #43, `853ed4d`). Phases 3 + 4 + follow-ups deferred. This file is the living roadmap for what's next.
**Design source of truth:** `C:\Users\kevin\hermes-drafts\DESIGN.md` (Mock A — Industrial Brutalist)
**Scope:** redesign + maintainability refactor + Reports sub-page + Featured Projects + accessibility

---

## Guiding constraints

- **Keep URLs stable.** `/projects/{owner}/{repo}`, `/lists/{slug}`, `/reports/state-of-hermes-april-2026` — no URL changes. Preserves SEO, backlinks, sitemap.
- **Work on a branch, land in one PR.** Rollback = revert the PR.
- **Sequential testing per feature.** Local → push → verify on Vercel → move on. No bundled pushes.
- **Preserve pSEO pipeline.** `generate-summaries.js` writes `summaries.json`; that's data, not HTML. Only `build-pages.js` (renderer) changes.
- **Don't break chunks.** The RAG chatbot reads `data/chunks.json` built from `research/`. HTML restructure shouldn't touch chunks unless we add `index.html` / page content to the knowledge base.

---

## Phase 0 · Bug fixes — ✅ SHIPPED (2026-04-17, commit `9bb5433`)

- [x] M1 — Fix duplicate repo in `index.html` (`portable-hermes-agent` / `portable-hermes` dedup; count now 93)
- [x] M2 — Refresh stale "80+" copy across meta tags
- [x] M5 — Delete stale `ecosystem-map.html` + `301` redirect
- [x] Sitemap regen

---

## Phase 1 · CSS componentization — ✅ SHIPPED (2026-04-18, on `v2-redesign`)

All inline `<style>` blocks extracted to `/assets/css/{tokens,base,index,page}.css`. `build-pages.js` emits `<link>` tags. Net: +1,609 / −17,337 lines.

---

## Phase 2 · v2 redesign to Mock A — ✅ SHIPPED (2026-04-18, commit `1c3d283`)

Industrial-brutalist system applied across index, project pages (93), list pages (6), report, 404. Space Grotesk + JetBrains Mono; amber `#d49a4f`; asymmetric grids; no gradients. Text `[light/dark]` theme toggle replaces sun/moon. Favicon swapped to amber `H` SVG.

---

## Phase 3 · New pages / information architecture — ⏳ PENDING

### Reports sub-page

- [ ] **`/reports/` index page** — list reports, most recent first; each entry: title, date, 1-line summary, read-time. (Only 1 report exists today: `state-of-hermes-april-2026`. Second was a duplicate, now deleted 2026-04-19.)
- [ ] **Update top nav** to include `reports` link.
- [ ] **Breadcrumb** on report detail pages: `reports / state of hermes — april 2026`.
- [ ] **Sitemap regen** to include `/reports/`.

### Featured Projects

- [ ] **`data/featured.json`** — weekly-rotating list of 2–3 project slugs + rotation metadata (week starting date).
- [ ] **Homepage featured module** — between hero strip and stats row. 2–3 repos shown with larger treatment (bigger name, short editorial blurb).
- [ ] **`/featured/` archive page** — list all historical featured picks. Link from homepage footer.
- [ ] **Rotation script** — `scripts/rotate-featured.js` (start manual curation, automate later).
- [ ] **Update nav** to include `featured` link.

---

## Phase 4 · Accessibility sweep — ⏳ PENDING

Target: `DESIGN.md §11`. Some items landed partially in Phase 2 (skip-link, reduced-motion, text theme toggle) — remaining is systematic.

- [x] Skip-to-content link (landed in Phase 2 `base.css`)
- [x] Text theme toggle replaces sun/moon (Phase 2)
- [x] `prefers-reduced-motion` honored (Phase 2 `base.css`)
- [ ] **Semantic landmarks** audit: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>` across all templates
- [ ] **Focus rings** verified on every interactive element (2px amber, 2px offset)
- [ ] **Alt text audit** on every `<img>`. Decorative → empty alt + `aria-hidden`.
- [ ] **`aria-label`** on icon-only buttons (close, clear, any remaining icons)
- [ ] **Form labels** on chat input, search input
- [ ] **Heading hierarchy** check: single `<h1>` per page, no skipping levels
- [ ] **Keyboard nav sweep** through every page template — logical order, no traps
- [ ] **Contrast verification** via axe DevTools on 3 sample pages per theme
- [ ] **Screen reader smoke test** on home → project page → list page flow

---

## Phase 5 · Review & ship — ✅ SHIPPED (2026-04-18)

v2 merged via PR #43. Kevin confirmed the live site looks great.

- [x] Local dogfood via `/browse`
- [x] Deploy preview on Vercel
- [x] Merge PR
- [ ] `/canary` post-ship 24h watch (optional — never ran, low value now that 24h+ have passed)
- [x] Memory updated (`project_hermes.md`)

---

## Phase 6 · The Hermes Handbook (SEO beginner's guide) — 🏗️ IN PROGRESS

**Goal:** rank #1 for "hermes agent guide / tutorial / getting started" and adjacent long-tail. Drive organic traffic into the Atlas by becoming THE canonical beginner's reference. Leverages our unfair advantages (93 curated projects, 6 lists, report, RAG).

**Architecture:** hub + satellites (topic cluster pattern)
- `/guide/` — long-form hub, ~4,000 words, 10 chapters
- `/guide/vs-claude-code/` — satellite #1 (ship alongside hub), high-intent comparison query
- `/guide/install/`, `/guide/telegram-setup/`, `/guide/first-skill/` — satellites #2–#4, added based on GSC signal

### Content

- [ ] **Outline + keyword table** — 10 chapters with target query per chapter + H2 subheads. Kevin approves before drafting.
- [ ] **Draft hub** — synthesize from `research/` (content exists; this is narrative + structure)
- [ ] **Draft satellite #1** (`vs-claude-code/`) — ~1,200 words, comparison table, verdict
- [ ] **FAQ block** — 8–12 beginner questions, `FAQPage` JSON-LD
- [ ] **Voice pass** — slightly warmer than rest of site; beginner-friendly without losing brutalist discipline
- [ ] **Fact-check pass** — every claim traceable to `research/` or `data/repos.json`

### Template + schema

- [ ] **`build-pages.js` extension** — `/guide/` template (matches `page.css` system; TOC sidebar on desktop; sticky "updated" stamp)
- [ ] **JSON-LD injection** — `Article` + `HowTo` (install chapter) + `FAQPage` (FAQ chapter)
- [ ] **OG images** — 1 per chapter for deep-link sharing (amber-H system, chapter title)
- [ ] **"Copy link to section" buttons** on every H2

### Internal linking

- [ ] **Out-links from guide** — every "memory" → `/lists/best-memory-providers`, every "skill" → `/lists/top-skills`, etc. Target: 20–30 contextual internal links
- [ ] **"Mentioned in the Handbook" badge** on project pages the guide cites (`build-pages.js` reads `data/handbook-mentions.json`). Target: ~20 projects

### RAG integration

- [ ] **Chunk the guide** — `build-chunks.js` picks up `/guide/` pages; chatbot answers from the guide directly. (Our moat — competing guides can't do this.)

### Site placement

- [ ] **Top nav** — add `handbook` link (between `lists` and `reports`)
- [ ] **Homepage hero callout** — rotate report banner to handbook CTA at launch
- [ ] **Sitemap regen** — `/guide/` + satellite URLs
- [ ] **Robots/canonicals** — self-canonical, no noindex

### Ship + measure

- [ ] Local dogfood via `/browse`
- [ ] Deploy preview on Vercel
- [ ] Merge PR
- [ ] **Outreach** — DM Nick Spisak, @teknium, Nous team; post in Nous Discord; X thread
- [ ] **GSC monitoring** — impressions / CTR / position weekly for 4 weeks
- [ ] **Satellite #1 ship** — alongside hub (or 1 week later if hub takes too long)
- [ ] **Retro at week 4** — ranking, backlinks, traffic; decide which remaining satellites to build

### Taste decisions (approved 2026-04-19)

- Product name: **The Hermes Handbook** (brand) + SEO `<title>` "Hermes Agent: The Complete Beginner's Guide (2026)"
- Positioning: aggressive — *the* canonical reference
- Scope: hub + `/guide/vs-claude-code/` at launch; satellites #2–#4 based on GSC signal
- Voice: slightly warmer than rest of site; still tight
- **Byline:** every page credits `[Kevin Simback](https://x.com/ksimback)` — must be hyperlinked to X profile
- **Dynamic metrics:** GitHub stars, forks, contributor counts etc. fetched live from `api.github.com/repos/NousResearch/hermes-agent` at write time, stamped "as of YYYY-MM-DD" in prose. Current snapshot (2026-04-19): **101,760 stars, 14,500 forks, 5,642 open issues, 395 watchers**.

---

## Security hardening (deferred from v2 scope)

Pre-existing v1 behavior, not v2-introduced. Tracked for a follow-up PR.

- [ ] Sanitize `marked` README output via DOMPurify / sanitize-html (contributor READMEs can contain raw `<script>` / `<iframe>`)
- [ ] Allowlist URL protocols in chat `renderMarkdown()` — currently `[text](javascript:…)` persists via localStorage replay
- [ ] Dedup masthead + theme-toggle CSS between `index.css` and `page.css` (~80 lines duplicated)

---

## Post-v2 backlog (older roadmap)

- **Issue #4** — Self-maintaining via Hermes Agent skill (auto-monitors + PRs updates)
- **Issue #6** — Use-case recommender ("I want to build X" → here are the repos you need)
- **May 2026 State of Hermes** report (when the month's data is in)
- **OG image cache** — Twitter card previews may still show blank; generated JPEGs are correct but Twitter's CDN is slow to update

---

## Dependencies & risk

| Concern | Risk | Mitigation |
|---|---|---|
| pSEO pipeline breaks | High | Already validated through v2 ship; re-run `generate-summaries.js` + `build-pages.js` on template changes. |
| RAG chunks stale | Low | Chunks reference `research/`, not page HTML. No regen needed unless page content is added to KB. |
| Sitemap drift | Medium | Regen sitemap after Phase 3 (new `/reports/`, `/featured/` URLs). |
| Theme LocalStorage key | Low | `theme` key preserved across v2 ship. |
| Mobile breakage | Medium | Test Phase 3 additions at 375px, 768px, 1280px. |

---

## Notes

- Phase 3 is the biggest visible next win (Reports index + Featured Projects).
- Phase 4 and Security are the quiet-but-important follow-ups.
- Compile-a-list approach: Kevin will flag items to discuss before kicking off follow-up work.
