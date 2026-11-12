# Hermes Agent v0.21.7 Release Notes

**Version:** v0.21.7
**Published:** 2026-10-12T05:53:41Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.21.7

# Hermes Agent v0.21.7

**Release Date:** October 11, 2026

> Patch release. This tag rolls up the ~204 PRs merged since v0.21.6 into a stable release for the desktop app (macOS Apple silicon, Windows), the Microsoft Store and MSIX, the installer, Docker and Hermes Cloud. Full curated notes for this window ship with v0.22.0.

<!-- HERMES_BUILDS_TABLE -->

**What this patch ships for source installs (`hermes update` and the desktop app's updater on a git checkout):**

- **Updates now follow tagged releases.** A source install of the official repository updates to the latest published `vX.Y.Z` release instead of every commit on `main`. An install already newer than the latest release stays where it is and waits for the next one; nothing is moved back. To keep following every commit: `hermes update --set-channel main`. Forks and mirrors keep following `main`. Store, MSIX and bundled desktop installs are unchanged.
- **Choose the channel in the desktop app.** Settings ▸ About ▸ Updates has an *Update channel* switch (Stable releases / Every commit) for source installs, and the update dialog now shows which channel you are on.
- **Reasoning survives resume.** Signed thinking replays after `hermes chat --resume` and on the next gateway turn, and Bedrock Converse reasoning models no longer get rejected on resumed sessions.
- **Updates no longer fail behind some firewalls.** Installs on `main` no longer fetch a release record that regional firewalls could answer with 403. The stable check uses your GitHub token when one is set (`GITHUB_TOKEN` or `gh auth login`) and reports a GitHub rate limit as a rate limit.

## About this release

Measured at commit `1fd18277267152893a8a24792b79213e7ca3f899`, the window since v0.21.6 contains **740 non-merge commits** across **4,156 changed files** (+86,775 / −26,980), **204 merged PRs** and **69 closed issues**.

Also in the window, undocumented here on purpose: plugins running built-in Desktop app actions (`ctx.runAction`) and a plugin SDK pet bubble (`ctx.pet.say`); core-made Codex requests so plugins never hold the token; skills installed mid-session reaching the model without a prompt rebuild; Krea 2 Medium Turbo as the default image lane for new paid subscribers, with a FAL fallback when managed Krea refuses a request; faster desktop updates (the React Compiler pass cached by content, the compiled renderer reused when only the install stamp changed, unchanged native inputs left in place); pinned installs that check out only the pin; compaction marks emitted to Relay; and new community plugins including memory-shield, command-ledger, Memoria, Model Router, wyoming-voice-bridge, codex-account-switch and redline.

**Full curated release notes for this window ship with v0.22.0**, which will document everything from v0.21.0 onward — highlights, feature areas, and complete contributor credits. Nothing in this window is skipped.

## Updating

- Desktop app: updates itself. Microsoft Store installs update through the Store.
- CLI: `hermes update`, or re-run the installer one-liner.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.21.6...v0.21.7](https://github.com/NousResearch/hermes-agent/compare/v0.21.6...v0.21.7)
