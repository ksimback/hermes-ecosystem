# Hermes Agent Plugins: What They Are, When You Need One, and Why Yours Won't Load

The Hermes plugins guide. Live version: https://hermesatlas.com/guide/plugins/ — facts sourced from the official Hermes plugin, plugin-catalog, built-in-plugin and Desktop Plugin SDK docs, plus the v0.22.0 and v0.23.0 release notes. Current release is v0.23.2 (as of 2026-11-16).

## TL;DR

A Hermes plugin is code that changes how the agent itself behaves: new tools, lifecycle hooks, slash commands, CLI subcommands, or a swapped-in backend (memory, model provider, messaging platform, terminal sandbox). Most people need fewer plugins than they think. Reach for a skill when the agent needs to know how to do something, an MCP server when it needs to reach an outside service, and a plugin only when you need to change the runtime. Plugins are off until you enable them, run with your user's permissions, and are not sandboxed by default — so pick a few good ones instead of installing a shelf.

## Plugin vs skill vs MCP server

- **Skill** — a SKILL.md document: instructions and know-how the agent loads when relevant. No code runs. Use it to teach a workflow, a house style, or a procedure.
- **MCP server** — an external process the agent calls over the Model Context Protocol, configured under `mcp_servers` in config.yaml. Use it to reach a service (GitHub, a database, a SaaS API) — and the same server works with Claude Code, Codex and other agents.
- **Plugin** — Python loaded into Hermes itself (`plugin.yaml` + a `register(ctx)` function). Use it when you need to intercept or change behaviour: veto a tool call (`pre_tool_call`), rewrite tool output, track cost, add a slash command, or replace a backend. A plugin can also bundle skills (namespaced `plugin:skill`) and call MCP tools (capability-gated, off by default).
- **Toolset** — not a separate thing to install: a named group of tools. Disabling a plugin also drops its toolset from your saved tool selection.

Rule of thumb: if a skill or an MCP server can do it, use that — they are portable and lower-risk. Plugins earn their place when the job is Hermes-specific runtime behaviour.

## "Plugin" means three different things

The official docs warn that "plugin" names several unrelated systems that do not share code, APIs, or delivery:

1. **Python plugins** (CLI and gateway) — `~/.hermes/plugins/<name>/` with `plugin.yaml` and `__init__.py`. This is what `hermes plugins install` manages and what most of this guide covers.
2. **Desktop plugins** — a single ESM file at `$HERMES_HOME/desktop-plugins/<id>/plugin.js` that imports `@hermes/plugin-sdk`. They add panes, pages, sidebar items, status-bar items, palette commands and themes to the native Hermes Desktop app, and hot-reload on save. Desktop plugins run with the app's authority.
3. **Web dashboard plugins** — a `manifest.json` plus a bundle on `window.__HERMES_PLUGIN_SDK__`, for `hermes dashboard`.

Only the backend `plugin_api.py` namespace (`/api/plugins/<id>`) is shared between the Desktop and dashboard systems. A catalog entry can ship a Python half, a Desktop half, or both.

## Plugin types

General plugins can be enabled in any combination. Some backend kinds are single-select:

- **General plugins** — tools, hooks, slash commands, CLI commands, bundled skills. Multi-select.
- **Memory providers** — replace or augment built-in memory. One active at a time, chosen by `memory.provider` (see the Memory Guidebook).
- **Context engines** — replace the built-in context compressor. One active at a time.
- **Model providers** — declare an inference backend; many can load, you pick one with `--provider` or config.
- **Backend plugins** — messaging platform adapters, image and video generation, delegation strategies, terminal sandboxes, computer-use drivers, TTS/STT, secret sources, web search and browser backends, approval transports.

## Finding plugins: the official catalog

The Hermes plugin catalog is a human-reviewed directory: every entry is added by a reviewed pull request and pins an exact 40-character commit, so a catalog install checks out the code the reviewer saw, not a branch tip. Browse it in Desktop (Capabilities → Plugins), on the docs site, or with `hermes plugins search <term>`.

Tiers: **Official** (maintained by Nous Research), **Verified** (verified by the Nous team to come from the company whose product it integrates), and **Community** (everything else). The catalog source in the hermes-agent repo lists 2,381 entries as of 2026-11-16 — 21 official, 13 verified, and the rest community — up from about 600 at v0.22.0 and over 1,050 at v0.23.0. The biggest shelves are tools (1,150) and Desktop (416), then automation, models and memory.

The official docs are explicit that catalog review is a point-in-time review, not a security audit. With thousands of community entries, the hard part is no longer finding a plugin — it is knowing which few are worth running. That is why the Atlas curates instead of mirroring the catalog.

## Install, enable, update

```
hermes plugins search <term>          # search the catalog
hermes plugins install <name>         # catalog entry, at its reviewed pin
hermes plugins install owner/repo     # straight from Git (no review)
hermes plugins enable <name>          # add to plugins.enabled
hermes plugins list                   # enabled / disabled / not enabled
hermes plugins update                 # list available updates, update all
hermes plugins remove <name>
```

- Installing does not enable. After `hermes plugins install` you are asked `Enable 'name' now? [y/N]` — the default is no. Use `--enable` for scripted installs.
- A memory provider asks a different question: `Use 'name' as the memory provider now?`. Only `memory.provider` activates a provider; `hermes memory setup` sets it later.
- For a reproducible Git install, pin a full commit: `hermes plugins install owner/repo --ref <40-char sha>`.
- Auto-update (`plugins.auto_apply`) is off by default. Updates that add capabilities ask for consent again.
- Inside a running session, `/plugins` shows what is actually loaded.

## Why won't my plugin load? A checklist

1. **It is installed but not enabled.** `hermes plugins list` shows three states: enabled, disabled, and *not enabled* (discovered, never opted in). The default for a new install is not enabled. Run `hermes plugins enable <name>`. A name in `plugins.disabled` always wins over `plugins.enabled`.
2. **It is a memory provider.** Enabling is not enough — set `memory.provider` (`hermes memory setup`). Only one provider runs at a time.
3. **It is in your project folder.** The gateway that runs every session never loads `./.hermes/plugins/`, and `HERMES_ENABLE_PROJECT_PLUGINS` has no effect on sessions. Install it as a user plugin instead.
4. **You changed config mid-session.** Enabled plugins load on the next session. Start a new one and check `/plugins`.
5. **It failed at load time.** The reason appears in the startup warning and the `/plugins` listing. A plugin whose import and `register()` take longer than `plugins.load_timeout_seconds` (default 10) is skipped with "load timed out" — usually a heavy or missing Python dependency.
6. **Its capabilities were never granted.** Installs without a terminal (scripts, CI) complete but do not grant declared capabilities. Run `hermes plugins enable <id>` interactively to grant them, and check with `hermes plugins capabilities <id>`.
7. **Wrong profile.** Installs and grants are recorded per profile, and a catalog install from Desktop goes to your default profile. Check the profile you are actually running.
8. **It is a Desktop plugin.** Desktop plugins live in `$HERMES_HOME/desktop-plugins/<id>/` and load in the app, not in `hermes plugins` sessions.
9. **Your Hermes is too old.** Catalog entries carry a `requires_hermes` floor that blocks installs on older versions. Run `hermes update`.
10. **You are writing it.** `hermes plugins doctor <path-or-id>` runs the real discovery, manifest parser and `register(ctx)` against a temporary home; `hermes plugins validate <path>` runs the catalog's admission check.

## Plugin safety

- **Opt-in.** Nothing with hooks or tools loads until you enable it.
- **Install-time scan.** Every install and update runs a static scan with three verdicts: safe (installs), caution (you confirm), dangerous (blocked — `--force` does not override). It catches known bad patterns, not everything.
- **Consent for privileged surfaces.** Capabilities such as overriding built-in tools are shown with a risk line and asked once; an update can never silently widen access.
- **Not a sandbox.** By default third-party Python plugins run inside the Hermes process with your user's permissions. `plugins.isolation: host` moves user-installed plugins into a separate process per profile; bundled plugins stay in-process. Desktop plugins run with the app's authority.
- **Tier is provenance, not an audit.** Official means Nous maintains it; Verified means it comes from the vendor; Community means a reviewer looked at one commit.

Before you install a community plugin: prefer catalog installs (pinned and reviewed) over raw `owner/repo`; read what it declares (tools, hooks, capabilities, required environment variables); be most careful with anything that gets credentials, a `pre_tool_call` or `transform_*` hook, or a messaging platform; and check that the repo is maintained.

## What moved into plugins in v0.22 and v0.23

- **Memory providers** (v0.22.0) — Honcho, Supermemory, Hindsight, Mem0, OpenViking and Holographic moved out of core to plugins maintained with their makers. Existing users were migrated automatically. ByteRover and RetainDB remain bundled.
- **Home Assistant, Spotify, Langfuse** (v0.22.0) — now official catalog plugins; migrated automatically.
- **Camofox, `mcp-serve`, the agent importers, Singularity** (v0.23.0) — moved to plugins that install themselves for anyone who used them.
- **`hermes mcp serve` is now `hermes mcp-serve`** (v0.23.0). MCP clients that launch Hermes as a server need their command updated — nothing rewrites it for you.
- **GitHub Copilot** (v0.23.0) — moved to the `github-copilot` Hermes Labs plugin, installed automatically for profiles that use it.
- **Browser tools** (v0.23.0) — the ten `browser_*` tools were removed in favour of `browser_exec`; Camofox users get the `camofox` plugin automatically. Update any skills or toolset lists that name the old tools.

## Bundled plugins worth knowing

Hermes ships a few plugins in the box, all opt-in: `disk-cleanup` (tracks and removes temporary files at session end), `security-guidance` (pattern-matches dangerous code on file writes and warns or blocks), `google_meet` and `teams_pipeline` (meeting transcription), image backends for OpenAI and xAI, and two dashboard tabs (Kanban and achievements).

## FAQ

**Do I need plugins at all?** Not to start. Hermes is complete without them. Add one when you hit a specific gap — cost control, observability, a messaging platform, a memory backend.

**Plugin or MCP server?** If it is "let the agent use service X", prefer MCP: portable and out-of-process. If it is "change how Hermes behaves", that is a plugin.

**Are catalog plugins safe?** Safer than random repos — reviewed, pinned and scanned — but the docs call review point-in-time, not an audit, and plugins run unsandboxed by default.

**I installed a plugin and nothing happened.** It is almost certainly not enabled: run `hermes plugins enable <name>` and start a new session. See the checklist above.

**Do Desktop and the CLI share plugins?** Python plugins load in the gateway that serves every surface, Desktop included. Desktop plugins are a separate format that only the app loads.
