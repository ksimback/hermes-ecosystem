# Contributing to Hermes Atlas

Hermes Atlas is a community-curated map of the Hermes Agent ecosystem. We rely on the community to help keep it current and comprehensive. Here's how you can help.

## Suggest a Repo

Found a Hermes Agent project that should be on the map?

1. Go to [Issues > New Issue > Suggest a Repo](https://github.com/ksimback/hermes-ecosystem/issues/new?template=suggest-repo.yml)
2. Paste the GitHub URL
3. Pick a category
4. Submit

That's it. Our automation fetches the repo metadata, runs a basic security check, and generates a PR. We review and merge if it passes our criteria.

### What gets included

- Must be specifically built for or integrated with Hermes Agent
- Created after July 22, 2025 (Hermes Agent launch date)
- Not a personal pet project or homework assignment
- Shows genuine effort and adds value to the ecosystem
- Has at least 1 GitHub star (exceptions for official/notable projects)
- Passes a basic security review (no obfuscated code, credential harvesting, etc.)

### What gets excluded

- Direct forks of hermes-agent without meaningful changes
- Repos that happen to use the word "hermes" but are unrelated to Nous Research
- Abandoned projects (no commits in 3+ months, broken README)
- Repos that fail security review

## Submit Documentation

Help keep the knowledge base current so the chatbot gives better answers.

1. Go to [Issues > New Issue > Submit Documentation](https://github.com/ksimback/hermes-ecosystem/issues/new?template=suggest-documentation.yml)
2. Paste the URL (blog post, tutorial, video, docs page)
3. Add a brief summary
4. Submit

We'll review the content and add it to the `research/` folder, which powers the "Ask the Atlas" chatbot.

### What makes good documentation

- Official Hermes Agent release notes and changelogs
- Setup guides and tutorials (especially for specific platforms/providers)
- Technical deep dives on Hermes architecture or features
- Comparison articles (Hermes vs OpenClaw, etc.)
- Community experience reports and best practices

### What we don't include

- Marketing fluff without technical substance
- Content that's primarily about a different product and only mentions Hermes in passing
- Paywalled content that most users can't access
- Content with factual errors about Hermes Agent

## Contribute Code

### Desktop plugin evidence catalog

`data/desktop-plugins.json` is a source-verified evidence inventory separate from the quality-filtered `data/repos.json` catalog. Read [`research/desktop-plugin-methodology.md`](./research/desktop-plugin-methodology.md) before changing it. Exact SDK/import/path searches are candidate discovery only.

Run `node scripts/refresh-desktop-plugins.js --validate` to verify the committed cutoff baseline offline. Use `GITHUB_TOKEN="$(gh auth token)" node scripts/refresh-desktop-plugins.js --check` for a no-write comparison with current default branches, and run without `--check` only after reviewing the revisions to advance. The verifier fetches source as text and never runs downloaded content. A directly supplied `GITHUB_TOKEN` works when GitHub CLI authentication is unavailable.

Maintainers can install the repository-local scout profile with `hermes profile install ./profiles/desktop-plugin-scout --alias`. After pulling Atlas changes, run `hermes profile update desktop-plugin-scout` because its recorded source is local.

### Adding a repo directly (for maintainers)

If you'd rather open a PR instead of an issue:

1. Add the repo to `data/repos.json` following the existing format:
```json
{
  "owner": "owner-name",
  "repo": "repo-name",
  "name": "display-name",
  "description": "One-line description",
  "stars": 123,
  "url": "https://github.com/owner-name/repo-name",
  "official": false,
  "category": "Skills & Skill Registries"
}
```
2. Add the corresponding `<a>` element to `index.html` in the correct category section
3. Open a PR

### Adding documentation directly

1. Create a markdown file in `research/` with a descriptive filename (e.g., `28-voice-mode-deep-dive.md`)
2. Include the source URL at the top of the file
3. Open a PR
4. The chunks rebuild runs automatically after merge

### Categories

| Category | What goes here |
|----------|---------------|
| Core & Official | NousResearch repos only |
| Skills & Skill Registries | Skill libraries, skill stores, agentskills.io implementations |
| Memory & Context | Memory providers, context engines, recall systems |
| Plugins & Extensions | Hermes plugins that add tools or capabilities |
| Multi-Agent & Orchestration | Multi-agent frameworks, fleet management, delegation |
| Workspaces & GUIs | Web UIs, desktop apps, dashboards for Hermes |
| Deployment & Infra | Docker images, Nix packages, deployment templates |
| Integrations & Bridges | Connectors to external platforms/services |
| Developer Tools | CLI tools, linters, migration helpers, dev utilities |
| Domain Applications | Purpose-built agents for specific use cases |
| Guides & Docs | Curated lists, tutorials, optimization guides |
| Forks & Derivatives | Meaningful forks with added functionality |

### Adding a use case

`/use-cases/` pages are curated bundles: a buildable outcome, the cross-category
stack it needs, and the real community stories that prove people actually build it.
They live in [`data/use-cases.json`](./data/use-cases.json) and are gated by
`node scripts/validate-use-cases.js`.

How the existing set was derived, and how to derive a new one:

1. **Start from demand, not from the catalog.** `data/user-stories.json` mirrors
   Nous's community story corpus (262 stories, 15 categories, MIT — refresh it with
   `node scripts/sync-user-stories.js`). Group the headlines by category and look
   for an outcome that recurs across several independent stories. If you can only
   find one story, it isn't a use case yet.
2. **Write the intent in the user's words** — "I want Hermes running 24/7 handling
   my inbox", not "Personal Assistant". The `aliases` array is what the on-page
   free-text matcher searches, so put the phrasings people actually type there.
   Aliases must be unique across all use cases, or the matcher is ambiguous.
3. **Assemble a stack that spans at least three catalog categories.** This is
   enforced. A single-category bundle is a `/lists/` page, and we already have those.
   Every repo must already exist in `data/repos.json` — the recommender never
   reaches outside the catalog.
4. **Order the stack by decision weight**, not by star count. The `rationale`
   should explain why *this* combination and *this* order; if it reads like it
   could describe any five repos, it isn't earned yet.
5. **Cite at least three stories by `id`.** Never paste a quote into
   `use-cases.json` — quotes are resolved from the corpus at build time, so an
   upstream removal fails the validator instead of leaving a stale quotation.
6. **Use `gaps` honestly.** "Nothing strong in the catalog yet for X" is useful
   signal and is preferred over padding a stack with a weak pick.

## Testing

We run a production smoke test after every deploy. See [`TESTING.md`](./TESTING.md)
for what gets checked, how to run it locally against a Vercel preview, and how
to acknowledge known-broken-but-deferred issues without blocking CI.

If you're adding a new build step, data file, or page layout, consider whether
it warrants a new smoke check — `TESTING.md` walks through the pattern.

## Questions?

- Try the [Ask the Atlas](https://hermesatlas.com) chatbot
- Open a [bug report](https://github.com/ksimback/hermes-ecosystem/issues/new?template=report-bug.yml)
- For Hermes Agent itself (not this site), go to [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent/issues)
