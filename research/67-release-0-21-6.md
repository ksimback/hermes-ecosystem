# Hermes Agent v0.21.6 Release Notes

**Version:** v0.21.6
**Published:** 2026-10-08T11:51:57Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.21.6

# Hermes Agent v0.21.6

**Release Date:** October 8, 2026

> Patch release. This tag rolls up the ~2,100 PRs merged since v0.21.5 into a stable tagged release for Docker and Hermes Cloud. Full curated notes for this window ship with v0.22.0.

<!-- HERMES_BUILDS_TABLE -->

## About this release

This is the first release cut by the new stable release pipeline: one attempt ref, a tested Docker image, and a receipt tag at publish. It ships the tag, this GitHub release and the Docker image. The desktop app, Termux packages and the Microsoft Store stay on their current build for now and move with the next bundled release.

Measured at commit `818c13be1dc4fd28987e1e881a9408224afd4535`, the window since v0.21.5 contains **8,867 non-merge commits** across **8,342 changed files** (+772,490 / −225,600), **2,106 merged PRs** and **3,027 closed issues**.

Also in the window, undocumented here on purpose: live transcription while you speak on CLI, TUI and Desktop (`stt.streaming`); spoken voice turns routed to their own model (`auxiliary.voice_chat`) with reasoning off by default; third-party plugins running in a per-profile plugin host (`plugins.isolation: host`) and one Settings ▸ Plugins home for their settings pages; favorite and pinned models at the top of the Desktop picker, a usage chip before a subscription hits its wall, and rate-limited providers that say why and until when; local models in `hermes model` plus llama.cpp CUDA on Linux x64 and arm64; pluggable, layered language packs across core, Desktop and TUI; a summary-first `hermes status` (`--short`, `--full`); a review-pane diff scope selector (Uncommitted / Branch / Last turn) and keep-awake that follows the turn; cron, `doctor` and home-channel warnings when the cron store goes unwritable; approval flags for credential uploads and invisible Unicode in terminal commands; a Discord setup that checks the bot token and prints the invite link; a unified Kanban workflow definition; `activate.fish`; GPT-6.1 Sol and Claude Sonnet 5.5 / Haiku 5.5 in the catalogs; and dozens of new community plugins.

**Full curated release notes for this window ship with v0.22.0**, which will document everything from v0.21.0 onward — highlights, feature areas, and complete contributor credits. Nothing in this window is skipped.

## Updating

- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).
- CLI (git installs): `hermes update`, or re-run the installer one-liner.
- Desktop app and Termux: no change in this release; they update with the next bundled release.

## Security Fixes

**Dashboard authentication hardening**

- Spoofed `X-Forwarded-For` headers could reset the password-login rate limit and get around the per-IP cap on native sign-in (#133367)
- Unauthenticated login requests could write unbounded values to the auth audit log (#133369)
- The public `/auth/` routes had no request-body size limit (#133370)
- Native sign-in could send login codes to a non-loopback redirect, which allowed session takeover (#130685)

Thanks to Tenable Research for reporting all four issues (TRA-725, TRA-726, TRA-727, TRA-728). The native sign-in redirect issue was also reported independently and fixed by @Froraut. The `X-Forwarded-For` fix builds on community work by @hinotoi-agent and @BearHuddleston (#40285).

**Repository git filter hardening**

- Automatic git calls (session workspace snapshot, subagent worktrees, kanban, worktree cleanup, `hermes -w`) could run `clean`/`smudge`/`process` filter programs defined by an untrusted repository's own config, before the first prompt (#130661)

Thanks to 燕涛 for reporting this privately. It was also reported and fixed publicly by @jonpol01 (#126017, #126019) and @JoaoMarcos44 (#126075).

**Email gateway sender hardening**

- A quoted display name in the `From` header (e.g. `"Victim <victim@example.com>" <attacker@evil.test>`) could make an attacker's message pass the email allowlist as an allowed sender (#125212)

Thanks to Daniel Steele (@keeltrace) for reporting this and writing the fix (#124322).


**Full Changelog**: [v2026.9.24...v0.21.6](https://github.com/NousResearch/hermes-agent/compare/v2026.9.24...v0.21.6)
