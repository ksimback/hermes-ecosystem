# Hermes Agent v0.22.4 Release Notes

**Version:** v0.22.4
**Published:** 2026-10-21T18:49:24Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.22.4

# Hermes Agent v0.22.4

**Release Date:** October 21, 2026

> Patch release. Desktop stops showing suggestion pills above the composer, plus small plugin and dashboard fixes, for the CLI and installer, the Microsoft Store app, Docker and Hermes Cloud.

<!-- HERMES_BUILDS_TABLE -->

## Fixes

- **Desktop no longer shows suggestion pills above the composer.** The pills appeared for no clear reason, mostly nudging you to set up MCP servers. They and the helpers that only they used are gone. ([#142559](https://github.com/NousResearch/hermes-agent/pull/142559))
- **Plugins that install nothing skip the dependency consent step.** A plugin that declares no dependencies, or whose `pyproject.toml` installs nothing, now enables without an empty consent prompt. ([#142569](https://github.com/NousResearch/hermes-agent/pull/142569))
- **Dashboard: WhatsApp can be safely re-paired after logging out.** ([#142439](https://github.com/NousResearch/hermes-agent/pull/142439))
- **Desktop plugin review:** the surface lint no longer flags prototype writes; reviewers check them by hand. ([#142586](https://github.com/NousResearch/hermes-agent/pull/142586))
- **Desktop: the approval-mode chip follows the active profile's mode.** ([#142565](https://github.com/NousResearch/hermes-agent/pull/142565))
- **Release builds:** the desktop bundle's pre-build check gets enough time to verify archived build inputs when storage is slow. ([#142623](https://github.com/NousResearch/hermes-agent/pull/142623))

Also new in the plugin catalog: bubblewrap (bwrap terminal backend on Linux), Singularity/Apptainer, mcp-serve (Hermes as an MCP server), agent-importers (`hermes import-agent`, now with Cursor), inbox and workflow-record from Hermes Labs. Telegram Business moves to the Hermes Labs community tier.

## About this release

Measured at commit `4d04303818b`, the window since v0.22.3 contains **14 non-merge commits** across **82 changed files** (+1,475 / −3,022) and **13 merged PRs**.

## Updating

- Microsoft Store app: updates through the Store.
- Desktop app installed from the installer (.exe / .dmg): no change in this release; it updates with the next bundled release.
- CLI: `hermes update`, or re-run the installer one-liner.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.22.3...v0.22.4](https://github.com/NousResearch/hermes-agent/compare/v0.22.3...v0.22.4)
