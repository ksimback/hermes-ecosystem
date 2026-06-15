# Testing & Production Health Checks

This doc covers how we verify the Atlas site stays healthy as it grows. There
are two layers: **pre-merge gates** (catch bugs before they reach `main`) and
**post-deploy smoke tests** (verify production is actually healthy after each
deploy).

## TL;DR

| When | What runs | What it catches |
|---|---|---|
| Pre-merge | Existing workflows (`audit-repos`, `validate-repo-suggestion`, Vercel preview build) | Schema errors, dead repos, build failures, bad submissions |
| Post-deploy | `post-deploy-smoke.yml` ← **new** | Drift between `data/repos.json` and rendered HTML, missing project pages, broken sitemap/RSS, 404s on critical pages, broken internal links |

The post-deploy smoke test runs automatically on every push to `main` that
touches site-affecting files. Results show up as a commit status next to
the Vercel deploy. Failures open (or update) a tracking issue labeled
`smoke-test-failure` so nothing rots silently in the Actions tab.

## Running the smoke test locally

```bash
# Against production (default)
node scripts/smoke-test-prod.js

# Against a Vercel preview URL
node scripts/smoke-test-prod.js --base https://hermes-ecosystem-git-mybranch-kevins-projects.vercel.app

# Test more project pages, keep going past failures
node scripts/smoke-test-prod.js --sample 50 --continue --verbose

# Acknowledge known-broken checks (becomes WARN, exit stays 0)
node scripts/smoke-test-prod.js --allow '/lists/,Core & Official count'
# or
SMOKE_ALLOW_FAILURES='/lists/,Core & Official count' node scripts/smoke-test-prod.js
```

**Windows / Git Bash note:** MSYS path conversion will mangle tokens that
start with a slash (e.g. `/lists/` becomes `C:/Program Files/Git/lists/`).
Prefix the invocation with `MSYS_NO_PATHCONV=1` or run from `cmd.exe` /
PowerShell. The Linux runner used by GitHub Actions isn't affected.

## What the smoke test checks

Each check below corresponds to a real failure mode the site has hit or could
plausibly hit. Add new checks here when we discover a new failure pattern that
the existing ones don't catch.

### 1. Critical pages return 2xx

Hits `/`, `/guide/`, `/lists/`, `/reports/`, `/privacy/`, `/sitemap.xml`,
`/rss.xml`, `/robots.txt`. Catches:

- A redirect chain breaking
- A build skipping a top-level page
- Vercel routing config (`vercel.json`) regressing
- A page rename that wasn't propagated to the menu

### 2. Homepage category counts match `data/repos.json`

For each `<section class="cat" data-category="...">` on the homepage, asserts
the count in `<span class="cat-count-n">N</span>` equals the number of repos
in `data/repos.json` with that category. Catches:

- The exact drift that bit PR #231 (bumped JSON, forgot to bump the
  homepage count span)
- A category renamed in JSON but not on homepage
- A category added in JSON with no homepage section yet

### 3. Project pages return 2xx (sample + recent)

Hits a sample of `/projects/<owner>/<repo>` URLs - all entries newer than
14 days plus a random 25 from the rest. Catches:

- `build-pages.js` skipped a repo
- A renamed `owner` or `repo` field left a stale page reference
- Vercel cache serving a stale 404 for a new project

### 4. Sitemap covers every project URL in `data/repos.json`

Parses `/sitemap.xml`, extracts every `<loc>` starting with `/projects/`,
asserts every repo in `data/repos.json` has a corresponding entry.
Catches sitemap generation drift.

### 5. RSS feed is well-formed

Quick XML well-formedness check on `/rss.xml`. Catches broken templating in
the RSS generator without needing a full XML schema validator.

### 6. Sample of internal links from homepage resolve

Pulls every `<a href="/...">` on the homepage, samples 25, asserts each
resolves. Catches stale internal anchor refs (e.g. a list URL pointing at a
slug we renamed).

## Adding a check

Open `scripts/smoke-test-prod.js`. Each check is a `section("label", async () => { ... })`
block. Add a new one following the pattern:

```js
await section("7. My new check description", async () => {
  // ...do the check...
  if (somethingIsBroken) {
    fail("specific check id", "what went wrong", "extra detail for triage");
  } else {
    pass("specific check id", "what passed and how much");
  }
});
```

Use unique strings for the check ID - the allow-list mechanism uses substring
match on it.

## Acknowledged failures

When the smoke test flags something that's a known issue we're not yet ready
to fix, we acknowledge it via the `SMOKE_ALLOW_FAILURES` env var in the
workflow. Acknowledgements convert FAIL → WARN (still reported, doesn't
block CI).

**Current acknowledgements** (audit quarterly; either fix or document why
they're permanent):

| Check ID | What | Fix path |
|---|---|---|
| `/lists/` | The `/lists/` index page 404s; only `/lists/<slug>` pages exist | Decide: build a list-index page, or remove from critical-pages set |
| `Core & Official count` | Homepage shows 5 in Core & Official; `data/repos.json` has 6 entries | Bump `<span class="cat-count-n">` from 5 to 6 in `index.html` Core & Official section |

When adding or removing entries from this list, **update the comment block in
`.github/workflows/post-deploy-smoke.yml` to match.** That comment block is
the human-readable triage source for what we're knowingly carrying.

## Pre-merge gates that already exist

These run on PRs and pushes:

| Workflow | What it does |
|---|---|
| `validate-repo-suggestion.yml` | Validates incoming repo-suggestion issues, generates a PR if they pass |
| `audit-repos.yml` | Periodic dead-repo check (GraphQL against GitHub) |
| `audit-summaries.yml` | Weekly LLM audit of generated summaries against current READMEs |
| `build-pages.yml` | Rebuilds project pages on push to `main` |
| `rebuild-chunks.yml` | Rebuilds the RAG chunks corpus |
| Vercel preview build | Catches build/deploy failures on PRs before merge |

## Recommended next-step hardening

In priority order, these are worth adding when the site complexity warrants:

### High value, low cost

1. **JSON schema validation for `data/repos.json`** as a PR gate. Catch
   missing required fields, invalid category names, duplicates, and bad
   URLs *before* CI merges them. Add a `pre-commit` hook or a tiny
   `validate-repos.yml` workflow that runs on PRs touching `data/repos.json`.
   Failure mode it would catch: a bad entry that builds but produces a
   misshapen project page.

2. **Run the smoke test against the Vercel preview deploy on every PR**, not
   just on `main` after deploy. Today the smoke test runs *after* merge,
   which means a regression has to be caught and reverted. If it ran on the
   preview URL, we'd catch the regression in the PR review cycle.
   Implementation: add a second job in `post-deploy-smoke.yml` triggered on
   `pull_request`, with `base` set to the Vercel preview URL pulled from
   the deploy event.

3. **Daily scheduled smoke run** (cron). Catches drift introduced by
   external sources (a project repo we list got deleted; GitHub renamed an
   org; Vercel cache poisoned). Already a known pattern via `audit-repos`.

### Medium value, medium cost

4. **HTML lint** on PRs. Use `html-validate` or similar to catch broken
   markup, unclosed tags, missing alt text, etc. The site is hand-edited
   HTML; this is a real failure mode.

5. **Lighthouse CI** as a PR comment. Track Core Web Vitals trends so we
   notice when something regresses page load or accessibility.

6. **Visual regression test** on the homepage and a sample of project pages
   (Playwright + Percy or Argos). Worth it if you start doing meaningful
   CSS/layout work; overkill until then.

### Lower priority / situational

7. **API smoke test** for `/api/chat` (the RAG chatbot). Needs an
   `OPENROUTER_API_KEY` secret in the workflow and consumes credits, so add
   only if the chatbot becomes load-bearing for the value proposition.

8. **External-link audit** (separate workflow, daily). Walk `data/repos.json`
   URLs and a sample of citation links in `research/` markdown. Distinct
   from `check-dead-repos.js` (which only checks the repo entries
   themselves); this would cover documentation rot.

9. **Status page** at `/status` (or a separate domain) that shows the last
   smoke run, last `build-pages` run, and any open `smoke-test-failure`
   issues. Useful once we get other people contributing.

## When the smoke test fails

1. Open the failing GitHub Action run from the commit status check
2. Look at the **Failures** section at the bottom of the smoke job log
3. If it's a real regression: revert the offending commit or push a fix
4. If it's a flake (network blip): rerun the workflow
5. If it's a known-issue we're deferring: add it to `SMOKE_ALLOW_FAILURES`
   in `.github/workflows/post-deploy-smoke.yml` with a comment in the
   triage block above explaining why and what would resolve it

The tracking issue (labeled `smoke-test-failure`) gets a new comment per
failed run, so check the timestamp before assuming it's the most recent.
