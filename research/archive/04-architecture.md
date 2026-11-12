# Hermes Agent — Architecture

**Source:** https://hermes-agent.nousresearch.com/docs/developer-guide/architecture

## System Overview

Three entry points feed into central AIAgent (run_agent.py):
- **CLI** (cli.py) — Interactive terminal
- **Gateway** (gateway/run.py) — Messaging platforms API server
- **ACP** (acp_adapter/) — IDE integration (VS Code, Zed, JetBrains)

## Directory Structure

```
hermes-agent/
├── run_agent.py              # Core conversation loop (~9,200 lines)
├── cli.py                    # Interactive terminal UI (~8,500 lines)
├── model_tools.py            # Tool discovery and dispatch
├── toolsets.py               # Tool groupings and presets
├── hermes_state.py           # SQLite session database with FTS5
├── agent/                    # Prompt building, compression, caching, memory
├── hermes_cli/               # CLI subcommands, config, auth, models
├── tools/                    # 47 tools across 20 toolsets
│   └── environments/         # Terminal backends (local, docker, SSH, modal, daytona, singularity)
├── gateway/                  # 14 platform adapters
├── acp_adapter/              # ACP server
├── cron/                     # Scheduler
├── plugins/memory/           # Memory provider plugins
├── environments/             # RL training
├── skills/                   # Bundled skills
├── optional-skills/          # Optional skills
├── website/                  # Docusaurus docs
└── tests/                    # 3,000+ tests
```

## Major Subsystems

1. **Agent Loop** — Synchronous orchestration (AIAgent in run_agent.py). Provider selection, prompt construction, tool execution, retries, compression, persistence. 3 API modes.
2. **Prompt System** — prompt_builder.py (assembly), prompt_caching.py (Anthropic cache), context_compressor.py (summarization)
3. **Provider Resolution** — Maps (provider, model) → (api_mode, api_key, base_url). 18+ providers, OAuth, credential pools.
4. **Tool System** — Central registry (tools/registry.py), 47 tools, 20 toolsets. Self-registers at import time. 6 terminal backends.
5. **Session Persistence** — SQLite + FTS5. Lineage tracking, per-platform isolation, atomic writes.
6. **Messaging Gateway** — 14 adapters, session routing, auth, slash commands, hooks, cron, background maintenance.
7. **Plugin System** — ~/.hermes/plugins/ (user), .hermes/plugins/ (project), pip entry points. Register tools, hooks, CLI commands.
8. **Cron** — First-class agent tasks. JSON storage, multiple schedule formats, skill attachment, multi-platform delivery.
9. **ACP** — Editor-native agent over stdio/JSON-RPC.
10. **RL / Trajectories** — Evaluation and training framework. Atropos integration, ShareGPT format.

## Design Principles

- Prompt stability (no mid-conversation changes)
- Observable execution (all tool calls visible via callbacks)
- Interruptible (API calls and tools cancellable)
- Platform-agnostic core (single AIAgent for all entry points)
- Loose coupling (registry patterns, check functions)
- Profile isolation (concurrent profiles with own config/data)
