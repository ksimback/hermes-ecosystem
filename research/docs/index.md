# Hermes Agent

**Source:** https://hermes-agent.nousresearch.com/docs

The self-improving AI agent built by [Nous Research](https://nousresearch.com). The only agent with a built-in learning loop — it creates skills from experience, improves them during use, nudges itself to persist knowledge, and builds a deepening model of who you are across sessions.

[Get Started →](/docs/getting-started/installation)[View on GitHub](https://github.com/NousResearch/hermes-agent)

## Install

**Linux / macOS / WSL2**

```
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

**Windows (native, PowerShell)** — _early beta, [details →](/docs/user-guide/windows-native)_

```
iex (irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1)
```

**Android (Termux)** — same curl one-liner as Linux; the installer auto-detects Termux.

See the full **[Installation Guide](/docs/getting-started/installation)** for what the installer does, the per-user vs root layout, and Windows-specific notes.

## What is Hermes Agent?

It's not a coding copilot tethered to an IDE or a chatbot wrapper around a single API. It's an **autonomous agent** that gets more capable the longer it runs. It lives wherever you put it — a $5 VPS, a GPU cluster, or serverless infrastructure (Daytona, Modal) that costs nearly nothing when idle. Talk to it from Telegram while it works on a cloud VM you never SSH into yourself. It's not tied to your laptop.

## Quick Links

🚀 **[Installation](/docs/getting-started/installation)**

Install in 60 seconds on Linux, macOS, WSL2, or native Windows (early beta)

📖 **[Quickstart Tutorial](/docs/getting-started/quickstart)**

Your first conversation and key features to try

🗺️ **[Learning Path](/docs/getting-started/learning-path)**

Find the right docs for your experience level

⚙️ **[Configuration](/docs/user-guide/configuration)**

Config file, providers, models, and options

💬 **[Messaging Gateway](/docs/user-guide/messaging)**

Set up Telegram, Discord, Slack, WhatsApp, Teams, or more

🔧 **[Tools & Toolsets](/docs/user-guide/features/tools)**

70+ built-in tools and how to configure them

🧠 **[Memory System](/docs/user-guide/features/memory)**

Persistent memory that grows across sessions

📚 **[Skills System](/docs/user-guide/features/skills)**

Procedural memory the agent creates and reuses

🔌 **[MCP Integration](/docs/user-guide/features/mcp)**

Connect to MCP servers, filter their tools, and extend Hermes safely

🧭 **[Use MCP with Hermes](/docs/guides/use-mcp-with-hermes)**

Practical MCP setup patterns, examples, and tutorials

🎙️ **[Voice Mode](/docs/user-guide/features/voice-mode)**

Real-time voice interaction in CLI, Telegram, Discord, and Discord VC

🗣️ **[Use Voice Mode with Hermes](/docs/guides/use-voice-mode-with-hermes)**

Hands-on setup and usage patterns for Hermes voice workflows

🎭 **[Personality & SOUL.md](/docs/user-guide/features/personality)**

Define Hermes' default voice with a global SOUL.md

📄 **[Context Files](/docs/user-guide/features/context-files)**

Project context files that shape every conversation

🔒 **[Security](/docs/user-guide/security)**

Command approval, authorization, container isolation

💡 **[Tips & Best Practices](/docs/guides/tips)**

Quick wins to get the most out of Hermes

🏗️ **[Architecture](/docs/developer-guide/architecture)**

How it works under the hood

❓ **[FAQ & Troubleshooting](/docs/reference/faq)**

Common questions and solutions

## Key Features

-   **A closed learning loop** — Agent-curated memory with periodic nudges, autonomous skill creation, skill self-improvement during use, FTS5 cross-session recall with LLM summarization, and [Honcho](https://github.com/plastic-labs/honcho) dialectic user modeling
-   **Runs anywhere, not just your laptop** — 6 terminal backends: local, Docker, SSH, Daytona, Singularity, Modal. Daytona and Modal offer serverless persistence — your environment hibernates when idle, costing nearly nothing
-   **Lives where you do** — CLI, Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, SMS, DingTalk, Feishu, WeCom, Weixin, QQ Bot, Yuanbao, BlueBubbles, Home Assistant, Microsoft Teams, Google Chat, and more — 20+ platforms from one gateway
-   **Built by model trainers** — Created by [Nous Research](https://nousresearch.com), the lab behind Hermes, Nomos, and Psyche. Works with [Nous Portal](https://portal.nousresearch.com), [OpenRouter](https://openrouter.ai), OpenAI, or any endpoint
-   **Scheduled automations** — Built-in cron with delivery to any platform
-   **Delegates & parallelizes** — Spawn isolated subagents for parallel workstreams. Programmatic Tool Calling via `execute_code` collapses multi-step pipelines into single inference calls
-   **Open standard skills** — Compatible with [agentskills.io](https://agentskills.io). Skills are portable, shareable, and community-contributed via the Skills Hub
-   **Full web control** — Search, extract, browse, vision, image generation, TTS
-   **MCP support** — Connect to any MCP server for extended tool capabilities
-   **Research-ready** — Batch processing, trajectory export, RL training with Atropos. Built by [Nous Research](https://nousresearch.com) — the lab behind Hermes, Nomos, and Psyche models

## For LLMs and coding agents

Machine-readable entry points to this documentation:

-   **[`/llms.txt`](/docs/assets/files/llms-bcf65f79b33e57e6c0cce5b9627945d4.txt)** — curated index of every doc page with short descriptions. ~17 KB, safe to load into an LLM context.
-   **[`/llms-full.txt`](/docs/assets/files/llms-full-1a9fc8671bab03c652f97c9c9d1f07d7.txt)** — every doc page concatenated into a single markdown file for one-shot ingestion. ~1.8 MB.

Both files also resolve at `/docs/llms.txt` and `/docs/llms-full.txt`. Generated fresh on every deploy.
