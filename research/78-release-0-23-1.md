# Hermes Agent v0.23.1 Release Notes

**Version:** v0.23.1
**Published:** 2026-11-10T01:42:15Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.23.1

# Hermes Agent v0.23.1

**Release Date:** November 9, 2026

> Patch release. This tag rolls up the ~618 PRs merged since v0.23.0 into a stable release for the GitHub release (CLI and installers), the Microsoft Store app, Docker and Hermes Cloud. Full curated notes for this window ship with v0.24.0.

**What this patch ships for plugin users:** since the plugin catalog's site deploy on November 9, the published `plugin-catalog.json` was larger than the 2 MiB cap clients accept, so every install silently fell back to the catalog it shipped with. `hermes plugins install <name>` could not find plugins added since your last update, installed the pin your release shipped instead of the current one, and missed newer `removed` entries. This release raises the cap to 16 MiB, so the live catalog is used again ([#151860](https://github.com/NousResearch/hermes-agent/pull/151860), fixes [#151856](https://github.com/NousResearch/hermes-agent/issues/151856), thanks @100yenadmin). Installs that stay on v0.23.0 or older keep falling back until they update.

<!-- HERMES_BUILDS_TABLE -->

## About this release

Measured at commit `3b421578588`, the window since v0.23.0 contains **2,578 non-merge commits** across **2,781 changed files** (+151,690 / −62,595), **618 merged PRs** and **409 closed issues**.

Also in the window, undocumented here on purpose: Esc backtrack in the TUI and classic CLI (replacing the rewind list picker), group chats that run on a gateway without Desktop and can seat bots from other computers, saved gateway connections shared by Desktop and the Webapp, signing the in-app browser in with your real browser profile and filling saved logins from its address bar, `hermes gateway attach` for local clients, `hermes clipboard image --json`, new plugin API (session-scoped environment values, plugin JSON-RPC methods and events, `llm.oneshot` auxiliary tasks, a compression-stable `conversation_id`, an `on_session_open` hook in the gateway, a `post_curator_run` hook), faster transcript and handoff reads, and a large batch of new plugin-catalog entries.

**Full curated release notes for this window ship with v0.24.0**, which will document everything from v0.23.0 onward — highlights, feature areas, and complete contributor credits. Nothing in this window is skipped.

## Updating

- Microsoft Store app: updates through the Store.
- Desktop app installed from the installer (.exe / .dmg): no change in this release; it updates with the next bundled release.
- CLI: `hermes update`, or re-run the installer one-liner.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.23.0...v0.23.1](https://github.com/NousResearch/hermes-agent/compare/v0.23.0...v0.23.1)
