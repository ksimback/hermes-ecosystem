# Hermes Agent v0.23.2 Release Notes

**Version:** v0.23.2
**Published:** 2026-11-16T20:59:18Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.23.2

# Hermes Agent v0.23.2

**Release Date:** November 16, 2026

> Patch release. This tag rolls up the ~1,989 PRs merged since v0.23.1 into a stable release for the GitHub release (CLI and installers), the Microsoft Store app, Docker and Hermes Cloud. Full curated notes for this window ship with v0.24.0.

<!-- HERMES_BUILDS_TABLE -->

## About this release

Measured at commit `ae2a81ccc00`, the window since v0.23.1 contains **7,918 non-merge commits** across **5,211 changed files** (+239,733 / −22,788), **1,989 merged PRs** and **940 closed issues**.

Also in the window, undocumented here on purpose: durable subagents that survive a gateway restart or crash and can be continued on their own conversation, one prompt-cache clock per session, `hermes fallback check` for fallback-chain readiness, `hermes update --force` to stop gateways at once instead of draining, one-time browser_vault codes entered from Telegram and Discord, opt-in shared Telegram DM threads, the Gemini Interactions API by default for Gemini 3 and later plus Gemini 4 Carbon, fast mode for Claude Mythos 5.2, per-job cron options (`wrap_response`, a fresh thread per run), new plugin APIs (`ctx.fork_session`, `ctx.redact_text()`, `ctx.register_idle_task`), compatibility shims so updates work across module moves, a slimmer macOS bundle that installs Chromium on first use, and a large batch of new plugin-catalog entries.

**Full curated release notes for this window ship with v0.24.0**, which will document everything from v0.23.0 onward — highlights, feature areas, and complete contributor credits. Nothing in this window is skipped.

## Fixed in the release candidate

- Desktop chats created by an August build with a bare `custom` provider can send again after updating (#156545).
- A Desktop or TUI reply that streamed beside a todo or memory call now settles instead of leaving the Stop button up (#156553).
- A crash mid-stream on Telegram and other edit-streaming chats no longer shows a duplicate "Recovered reply"; a word holding a key prefix mid-word (`program_id`) is shown on time again (#156546).
- Desktop no longer loses or scrambles what you type while it starts and resumes your last chat (#156615, #156642).
- After a reconnect mid-reply, Desktop shows the reply once and in full, attachments included (#156611).
- In the Webapp, opening Hermes Cloud agents while this install isn't signed in to Nous Portal now tells you to sign in to Nous Portal instead of sending you to the Webapp login (#156652).
- Exiting the CLI while its startup update check is waiting on GitHub no longer leaves `git` running (#156616).

## Updating

- Microsoft Store app: updates through the Store.
- Desktop app installed from the installer (.exe / .dmg): no change in this release; it updates with the next bundled release.
- CLI: `hermes update`, or re-run the installer one-liner.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.23.1...v0.23.2](https://github.com/NousResearch/hermes-agent/compare/v0.23.1...v0.23.2)
