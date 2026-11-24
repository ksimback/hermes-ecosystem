# Hermes Agent v0.23.4 Release Notes

**Version:** v0.23.4
**Published:** 2026-11-24T08:17:06Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.23.4

# Hermes Agent v0.23.4

**Release Date:** November 23, 2026

> Patch release. This tag rolls up the ~229 PRs merged since v0.23.3 into a stable release for the GitHub release (CLI and installers), the Microsoft Store app, Docker and Hermes Cloud. Full curated notes for this window ship with v0.24.0.

<!-- HERMES_BUILDS_TABLE -->

## About this release

Measured at commit `8fc03744473`, the window since v0.23.3 contains **1,122 non-merge commits** across **1,316 changed files** (+96,873 / −6,703), **229 merged PRs** and **281 closed issues**.

Also in the window, undocumented here on purpose: Gemini 4 Hydrogen, Neon and Carbon on Nous Portal, OpenRouter and Vertex, `hermes gateway migrate --backends` to move an old serve/dashboard backend onto the gateway (with a System page card in the dashboard), `hermes plugins config` to edit a plugin's settings from the terminal, approval cards in Desktop for a sandbox's folder and site requests, gateway clients announcing who they are so plugins can see which client sent a turn, a long run of Desktop streaming and transcript performance work, a retryable indicator for slow profile switches, `hermes dashboard password` without a TTY prompt, configurable skill index description length (`skills.index_desc_limit`), managed-scope config honored by security and URL-safety reads, and a large batch of new plugin-catalog entries.

**Full curated release notes for this window ship with v0.24.0**, which will document everything from v0.23.0 onward — highlights, feature areas, and complete contributor credits. Nothing in this window is skipped.

## Updating

- Microsoft Store app: updates through the Store.
- Desktop app installed from the installer (.exe / .dmg): no change in this release; it updates with the next bundled release.
- CLI: `hermes update`, or re-run the installer one-liner.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.23.3...v0.23.4](https://github.com/NousResearch/hermes-agent/compare/v0.23.3...v0.23.4)
