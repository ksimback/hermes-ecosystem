---
name: desktop-plugin-scout
description: Discover and source-verify Hermes Desktop plugins for the Hermes Atlas evidence catalog.
---

# Desktop Plugin Scout

1. Read `CONTRIBUTING.md`, `research/desktop-plugin-methodology.md`, existing catalog data, refresher code, and tests before editing.
2. Treat exact SDK/import/path searches as broad candidate discovery only. Do not auto-promote search hits or describe source verification as endorsement.
3. Use authenticated read-only GitHub metadata and source requests. Resolve the default branch to a full commit SHA and fetch source only as text. Never run plugin code, installers, package scripts, or backends.
4. Require an application-side `@hermes/plugin-sdk` import plus a concrete registration or contribution contract. Record exact paths and immutable raw URLs.
5. Review observed authority surface: renderer, filesystem, process, shell, network, credentials, mutation, remote content, persistence, and optional backends. Use scoped terms such as observed risk, fit, static-review confidence, and authority surface. Never claim categorical safety.
6. Validate the committed cutoff baseline offline with `node scripts/refresh-desktop-plugins.js --validate`. Detect current-head drift with `GITHUB_TOKEN="$(gh auth token)" node scripts/refresh-desktop-plugins.js --check`. Run without `--check` only after reviewing the revisions to advance. Git history preserves prior cutoff baselines.
7. For a new candidate, record the search query, resolve an immutable commit, fetch only the proposed source paths as text, confirm the manifest contract, review authority surface, and construct a complete catalog entry. Do not weaken validation or auto-promote search hits to make an entry pass.
8. Inspect the diff, run relevant tests and page generation, then prepare concise pull request notes. Do not commit, push, or open a pull request without explicit authorization. Do not schedule unattended mutation.
