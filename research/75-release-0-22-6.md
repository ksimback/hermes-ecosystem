# Hermes Agent v0.22.6 Release Notes

**Version:** v0.22.6
**Published:** 2026-11-02T17:18:36Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.22.6

# Hermes Agent v0.22.6

**Release Date:** November 2, 2026

> Patch release. This tag rolls up the ~776 PRs merged since v0.22.5 into a stable release for the GitHub release (CLI and installers), the Microsoft Store app, Docker and Hermes Cloud. Full curated notes for this window ship with v0.23.0.

<!-- HERMES_BUILDS_TABLE -->

## About this release

Measured at commit `f0d94882e89`, the window since v0.22.5 contains **3,448 non-merge commits** across **4,316 changed files** (+248,579 / −94,077), **776 merged PRs** and **385 closed issues**.

Also in the window, undocumented here on purpose: the Webapp served from the gateway's own listener (`hermes webapp`, a Desktop Web Access pane to open it on your network or your own URL behind Nous sign-in, and Desktop plugins loading in a browser tab), `/model reset` to clear a session's model pin without losing history, per-skill locks against autonomous writes (lockable from the Desktop Capabilities pane), opt-in prepared compaction (`compression.prepare_ahead`), `hermes cron cancel` plus a per-job missed-run policy and a Stop button in the Desktop cron editor, `/delegation` choices saved for the next session, `hermes migrate` and setup moving Grok Bot and OpenBot users over, opt-in OS-keychain storage for the vault key, the catalog's `requires_hermes` enforced at plugin install and update, agent-picked ElevenLabs voices in `text_to_speech`, a `pre_llm_call` hook that can block a turn before inference, Desktop group chat rename, disband, mentions and attachment paste, every profile shown as a Desktop sidebar section, Telegram video notes, Slack emoji reactions in thread context, and resumable downloads in the package manager.

**Full curated release notes for this window ship with v0.23.0**, which will document everything from v0.22.0 onward — highlights, feature areas, and complete contributor credits. Nothing in this window is skipped.

## Updating

- Microsoft Store app: updates through the Store.
- Desktop app installed from the installer (.exe / .dmg): no change in this release; it updates with the next bundled release.
- CLI: `hermes update`, or re-run the installer one-liner.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.22.5...v0.22.6](https://github.com/NousResearch/hermes-agent/compare/v0.22.5...v0.22.6)
