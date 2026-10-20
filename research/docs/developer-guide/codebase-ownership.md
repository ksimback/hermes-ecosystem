# Codebase Ownership Map

**Source:** https://hermes-agent.nousresearch.com/docs/developer-guide/codebase-ownership

Hermes is a large repository, and most contributions touch exactly one subsystem. This page maps each subsystem to its source directories and the documentation entry point you should read before changing it. Use it to find the right starting doc, the right place for a change, and the right test directory (tests mirror source: code in `tools/` is tested in `tests/tools/`, plugins in `tests/plugins/<type>/`, and so on).

Subsystem

Source directories

Docs entry point

Agent core (loop, transports, compression)

`agent/`, `run_agent.py`

[Agent Loop](/docs/developer-guide/agent-loop), [Context Compression & Caching](/docs/developer-guide/context-compression-and-caching)

Prompt assembly

`agent/prompt_builder.py`, `agent/system_prompt.py`

[Prompt Assembly](/docs/developer-guide/prompt-assembly)

Model providers & transports

`agent/transports/`, `plugins/model-providers/`, `hermes_cli/models.py`

[Adding Providers](/docs/developer-guide/adding-providers), [Model Provider Plugins](/docs/developer-guide/model-provider-plugin), [Provider Runtime](/docs/developer-guide/provider-runtime)

Built-in tools

`tools/`

[Adding Tools](/docs/developer-guide/adding-tools), [Tools Runtime](/docs/developer-guide/tools-runtime)

Messaging gateway

`gateway/`, `plugins/platforms/`

[Gateway Internals](/docs/developer-guide/gateway-internals), [Adding Platform Adapters](/docs/developer-guide/adding-platform-adapters)

CLI

`hermes_cli/`

[Extending the CLI](/docs/developer-guide/extending-the-cli)

Plugins system

`plugins/`

[Build a Hermes Plugin](/docs/developer-guide/plugins)

Skills (bundled & optional)

`skills/`, `optional-skills/`

[Creating Skills](/docs/developer-guide/creating-skills)

Cron / scheduled jobs

`cron/`

[Cron Internals](/docs/developer-guide/cron-internals)

Session storage

`hermes_state.py`, `hermes_state_*.py`

[Session Storage](/docs/developer-guide/session-storage)

Browser stack

`tools/browser_tool.py`, `tools/browser_supervisor.py`, `tools/browser_cdp_tool.py`

[Browser Supervisor](/docs/developer-guide/browser-supervisor)

Egress firewall

`agent/proxy_sources/iron_proxy.py`

[Egress Internals](/docs/developer-guide/egress-internals)

ACP (IDE integration)

`acp_adapter/`

[ACP Internals](/docs/developer-guide/acp-internals)

Desktop app

`apps/desktop/`

[Desktop Plugin SDK](/docs/developer-guide/desktop-plugin-sdk), [Worktree UI Development](/docs/developer-guide/worktree-ui-dev)

TUI

`ui-tui/`, `tui_gateway/`

[Worktree UI Development](/docs/developer-guide/worktree-ui-dev)

Docs site

`website/`

[Contributing](/docs/developer-guide/contributing)

Tests

`tests/`, `tests-js/`

[Contributing → Before Submitting](/docs/developer-guide/contributing#before-submitting)

A few conventions that fall out of this map:

-   **Changes should stay inside their subsystem.** A plugin that needs to edit core files is a design smell — widen the generic plugin surface instead (see the contribution rubric in the repository's `AGENTS.md`).
-   **Run the mirror test directory for every source directory you touch.** A change to `plugins/platforms/telegram/` needs `tests/plugins/platforms/` green, not just the test file you happened to think of.
-   **When two subsystems are involved, the narrower one owns the change.** Prefer a fix in an adapter or plugin over a branch in the agent core; the core is a narrow waist, and every addition there is paid for on every API call.
