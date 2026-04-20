# Hermes Agent: The Complete Beginner's Guide (2026)

By [Kevin Simback](https://x.com/ksimback) · Hermes Atlas maintainer · Updated 2026-04-20

> Based on 93 ecosystem projects reviewed, 33 research sources, and the live GitHub repo. We update this handbook monthly.

---

## Table of contents

1. [What Hermes Agent actually is](#1-what-hermes-agent-actually-is)
2. [Who Hermes is for](#2-who-hermes-is-for)
3. [How it's different (vs Claude Code, Cursor, OpenClaw)](#3-how-its-different)
4. [Install in 2 minutes](#4-install-in-2-minutes)
5. [Pick your model (the first-weekend mistake)](#5-pick-your-model)
6. [Your first workflow](#6-your-first-workflow)
7. [The learning loop](#7-the-learning-loop)
8. [Essential skills to install first](#8-essential-skills-to-install-first)
9. [Where to go next](#9-where-to-go-next)
10. [FAQ](#10-faq)

---

## 1. What Hermes Agent actually is

**Hermes Agent is an open-source AI agent by [Nous Research](https://nousresearch.com) that runs on your own machine or a cheap VPS, remembers what it learns across sessions, and writes its own reusable skills as it works. It talks to you through a CLI, Telegram, Discord, email, and many other messaging providers. It hit 104,791 GitHub stars (as of 2026-04-20), and it's the fastest-growing open-source agent of 2026.**

### The 30-second version

You install Hermes with one curl command. You pick a model provider (many popular options) and a model (Claude, GPT-5.4, GLM-5.1, MiniMax, or even a local Ollama model). You give it a job — "summarize my GitHub notifications every morning at 8am," or "help me debug this Python script," or "watch this website and ping me on Telegram when the price drops."

It runs. It learns. A week later, the same job produces tighter output because Hermes has been quietly writing skills — little markdown files that capture what worked — and pulling them into future runs.

That's the whole product. Install, assign tasks, and let it compound.

### The 2-minute version

Most AI tools are stateless: you open a chat, ask a question, close the tab, and the next session starts from zero. Hermes inverts that. It lives on a personal computer or virtual private server. It has persistent memory. It creates skills — procedures it can reuse — every time it figures something out. And it reaches you through whatever channel you prefer: a terminal, a Telegram bot, a scheduled cron job, a webhook.

The big architectural bet is **Harness Engineering**: Nous believes the real unlock in 2026 isn't a smarter model, it's a smarter wrapper around the model. So Hermes invests heavily in five layers around the LLM — instructions, constraints, feedback, memory, orchestration — and lets you swap the model itself. Frontier today, local tomorrow, something else next year.

You'll hear people call this "the agent that grows with you." That's Nous's tagline and it's also a useful mental model: on day one Hermes is a generic assistant. On day thirty it's *your* assistant, with thirty days of learned preferences baked in.

### Preview: the learning loop

Every few tool calls, Hermes pauses and asks itself: *what just happened, what worked, what failed, should this become a skill?* When the answer is yes, it writes a skill file to `~/.hermes/skills/` and uses it going forward. These skills are plain markdown. You can read them, edit them, or delete the ones it got wrong.

This is the single feature that matters most and the one we'll unpack in [chapter 7](#7-the-learning-loop).

---

## 2. Who Hermes is for

Hermes attracts three kinds of people. Figure out which one you are and the rest of the handbook makes more sense.

### The CLI coder

You live in a terminal. You already use Claude Code or Cursor for in-editor coding. You want an agent that sits *outside* your editor — something you can ask to "audit the repo for dead code" or "write a migration plan for our 0.9 → 0.10 upgrade" without leaving the CLI.

**What you'll use first:** the `hermes` CLI, skills, memory. **Ignore for now:** Telegram, cron, multi-agent.

### The automation operator

You don't necessarily code. You want an agent that does recurring jobs — summarize news, watch markets, generate reports, triage your inbox — while you sleep. You'll host Hermes on a Mac Mini or $5 VPS and wire it to whatever channels you use.

**What you'll use first:** cron, messaging gateways, memory. **Ignore for now:** code execution, multi-agent.

### The Telegram-bot operator

You want an always-on agent you can message from your phone. Travel, meetings, gym — doesn't matter, you ping Hermes and it responds. The Telegram integration is the killer feature here.

**What you'll use first:** the messaging gateway, voice, skills. **Ignore for now:** local CLI usage.

### Which one are you?

| If you want to... | Start with... | Skip (for now) |
|---|---|---|
| Write better code from the terminal | CLI + skills | Telegram, cron |
| Automate recurring jobs | Cron + gateway | Code execution |
| Chat with an agent from your phone | Telegram + voice | CLI workflows |

All three can coexist later. Pick one for the first week.

---

## 3. How it's different

You probably already use Claude Code, Cursor, or OpenClaw. Where does Hermes fit?

### The one-liner

**Claude Code is an in-repo coding agent. Cursor is an in-editor pair programmer. OpenClaw is a configuration-driven task runner. Hermes is a self-improving autonomous agent that lives outside all of them.** Most power users run two or three of these together, not one.

### Comparison at a glance

| Feature | Claude Code | Cursor | OpenClaw | **Hermes Agent** |
|---|---|---|---|---|
| Primary surface | CLI in a repo | IDE | CLI + configs | CLI + chat + cron + Telegram |
| Persistent memory | Session-scoped | Project-scoped | Config-file based | **Cross-session, bounded (MEMORY.md, USER.md)** |
| Learning | None | None | None | **Auto-generates skills after repeated patterns** |
| Channels | Terminal | Editor | Terminal | **Terminal, Telegram, Discord, email, webhooks** |
| Scheduled jobs | No | No | No | **Built-in cron** |
| Self-improvement | No | No | No | **Yes, via skills + memory** |
| Model lock-in | Anthropic | Multiple | Multiple | **18+ providers, swap with one command** |
| Best for | Coding in a repo | Writing code inline | Running shell workflows | **Long-running autonomous tasks that compound** |

### When to pick which

- **Pick Claude Code** when you're inside a repo and want the agent to read code, edit code, run tests, commit. It's a coding specialist.
- **Pick Cursor** when you want AI completions and fixes inside your editor in real time.
- **Pick OpenClaw** when you want to declaratively configure a task runner with composable commands.
- **Pick Hermes** when you want an agent that (a) lives beyond any single session, (b) talks to you from any channel, (c) gets better at your recurring work over time.

### You probably want to run two

Most of the community runs Hermes *alongside* Claude Code. Claude Code for inside-the-repo coding. Hermes for everything else: daily briefings, monitoring, automation, multi-repo research, cross-channel coordination. They don't compete; they stack.

If you're migrating from OpenClaw, Nous ships a migration tool that ports your configs automatically. That friction is near zero.

Deeper comparison: see the **[Hermes vs Claude Code full breakdown →](/guide/vs-claude-code/)**

---

## 4. Install in 2 minutes

Installing Hermes is one curl command followed by two small config steps. If everything works, you're done in under two minutes. If it breaks, it's almost always one of three things, all covered below.

### Prerequisites

- **macOS, Linux, or Windows (WSL2).** Bare Windows isn't officially supported yet; use WSL2 (install link on the Hermes GitHub page).
- **A terminal.** Any shell works — bash, zsh, fish.
- **An API key or a local model.** If you don't have a model provider or want to set up a new one for your agent, a great place to start is the [Nous Portal](https://portal.nousresearch.com) — otherwise just grab an API key from your model provider, or a local Ollama/LM Studio install. You can always swap model providers later.
- **~200 MB of disk** for the install plus whatever you use for memory and skills.

### Install

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | sh
```

This drops the `hermes` binary in `~/.hermes/bin/` and adds it to your PATH. The installer prints everything it does — no hidden steps.

### First run

```bash
hermes
```

Hermes walks you through provider setup interactively on the first run. Paste an API key when prompted, or point it at a local model. Confirm with `hermes model` to see what's configured.

### Verify

```bash
hermes doctor
```

Prints a health report. Green across the board means you're ready. Red lines usually map to one of the pitfalls below.

### Three common pitfalls

1. **"Command not found: hermes"** → your shell didn't pick up the new PATH. Open a fresh terminal or run `source ~/.bashrc` (or `~/.zshrc`).
2. **"Provider error: invalid key"** → the key you pasted has a trailing space or is for the wrong provider. Re-run `hermes model` and paste carefully.
3. **Windows: "bad interpreter"** → you're on bare Windows, not WSL2. Install WSL2 (`wsl --install` in PowerShell), then rerun the curl install from inside WSL.

Everything else is rare. If `hermes doctor` shows a problem it doesn't explain, open an issue on [the Hermes repo](https://github.com/NousResearch/hermes-agent) — the Nous team triages quickly.

---

## 5. Pick your model

**This is where most first-time setups silently fail.** If Hermes feels broken, dumb, or slow in your first session, the model is almost always the reason — not Hermes. Spend two minutes here and save yourself a weekend.

### The first-weekend mistake

Hermes delegates heavily to the model. Tool calling, planning, skill writing — it's all the model's job. Small or older models can't reliably call tools, so they get stuck in loops or produce garbage. **Gemma 2B, Llama 3.1 8B, and other sub-frontier models are almost always the wrong default.** They run fine for chat, not for agent workflows.

The community consensus: use a frontier model for real work; use a local model only for experimentation.

### Cost and capability at a glance

| Model | Price tier | Tool calling | Speed | Best for |
|---|---|---|---|---|
| Claude Sonnet / Opus | $$$ | Excellent | Fast | Production agent workflows |
| GPT-5 | $$$ | Excellent | Fast | Production, OpenAI stack users |
| z.AI GLM-5 | $ | Excellent | Fast | Best-value frontier |
| MiniMax M2.7 | $$ | Excellent | Fast | Excellent value |
| DeepSeek | $ | Good | Fast | Cost-optimized workflows |
| Nous Portal (subscription) | $ (flat) | Excellent | Fast | Predictable monthly cost |
| Ollama + Qwen 2.5 Coder | Free (local) | Good | Depends on GPU | Offline coding, privacy-sensitive work |
| Ollama + Gemma / Llama 8B | Free (local) | **Poor** | Depends on GPU | Chat-only; don't use for agent work |


### When local is fine, when it isn't

- **Local is fine when:** you're drafting code snippets, chatting, or running single-shot summarization. Ollama + Qwen 2.5 Coder 32B handles 80% of everyday CLI use.
- **Local isn't fine when:** you want multi-step tool calls (watch a site, call an API, summarize, post to Telegram). You'll hit loops, timeouts, and bad tool arguments. Switch to a frontier API.

### The easy button: Nous Portal

If you don't want to manage API keys across providers, Nous Portal is a single subscription that covers Claude, GPT, GLM, MiniMax, Nous's own models, and many more via one auth. Sign in with OAuth from the CLI. You pay one flat monthly fee and stop thinking about which key is which. Most people end up here eventually.

---

## 6. Your first workflow

Don't try to build three things at once. Pick one of the following examples and ship it today. Each takes 10–30 minutes and teaches you a different half of Hermes.

### Example 1 — Coding assistant on your laptop

```bash
cd ~/projects/my-repo
hermes
> audit this repo for dead code, imports that aren't used, and commented-out blocks older than 6 months. Produce a markdown report.
```

What you'll notice: Hermes reads files, runs greps, and writes the report to `./hermes-output/` by default. The second time you ask the same kind of question, it's faster — because it wrote a skill called `repo-audit` on run one.

**Why this is a good first workflow:** zero infrastructure, tangible output, and you'll see the skill system kick in inside one afternoon.

### Example 2 — Telegram bot on a $5 VPS

On any cheap Linux VPS (Hetzner, Digital Ocean, Hostinger, a Raspberry Pi, whatever):

```bash
# install Hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | sh

# set up the Telegram gateway
hermes gateway setup
# paste your bot token from @BotFather
# paste your numeric Telegram user ID (use @userinfobot) — NOT your @username

# start the daemon
hermes daemon start
```

Message your bot. It responds. Now add a job:

```
> every morning at 8am, summarize my GitHub notifications and send them to me here
```

Hermes writes a cron entry, stores your preference in memory, and pings you at 8am tomorrow. Leave the VPS running.

**Common gotcha:** the Telegram allowlist needs your numeric user ID (a number like `123456789`), not your `@handle`. Using the handle silently accepts messages from anyone who guesses your handle. Use `@userinfobot` on Telegram to get your numeric ID.

**Why this is a good first workflow:** you walk away with a running always-on agent for $5/month. Every other workflow you build from here reuses this setup.

### Example 3 — Daily cron briefing

No bot, no chat. Just a scheduled job that emails or DMs you one summary every morning.

```bash
hermes
> every weekday at 7:30am, collect: (1) top 10 HN posts overnight, (2) my unread GitHub notifications, (3) weather in Seattle. Send as a plain-text email to me@example.com.
```

Hermes schedules the cron job, remembers your email and city, and starts running it. Wake up tomorrow and check your inbox.

**Why this is a good first workflow:** it's low-surface, always-on, and teaches you how Hermes treats scheduled workflows as first-class citizens.

---

## 7. The learning loop

This is the section worth slowing down for. If you understand the learning loop, you understand why Hermes is shaped the way it is.

### Why Hermes gets better over time

After every task — or every five-ish tool calls — Hermes runs a short retrospective against itself: *did that work? what took too long? what did the user reject? is there a reusable pattern here?* When the answer is yes, it writes a new skill or updates memory. The next time you make a similar request, Hermes reaches for the skill first and skips the rediscovery.

This is the opposite of a stateless chat. A stateless chat throws away everything at the end of each conversation. Hermes writes it down.

### Bounded memory: a feature, not a bug

Memory is stored in three places:

- `MEMORY.md` — short-term, ~2,200 characters max. What the agent is working on right now.
- `USER.md` — facts about you, ~1,375 characters max. Name, preferences, role, constraints.
- **Session search** (FTS5 full-text index) — every past conversation is searchable.

The small caps are deliberate. Unlimited memory sounds attractive until you realize that's how agents turn into junk drawers of stale context. Hermes forces consolidation: when `MEMORY.md` fills up, the agent has to decide what's worth keeping. That discipline keeps the working context tight and the model focused.

If you want unlimited semantic memory, there are eight community memory providers (Honcho, Mem0, Hindsight, Supermemory, and others) that plug in on top. See [best memory providers →](/lists/best-memory-providers).

### Skills: executable procedures, not notes

Skills are the part everyone undersells. A skill is a markdown file at `~/.hermes/skills/<name>/SKILL.md` that describes:

- **When** to trigger it (a short description the orchestrator reads)
- **How** to run it (instructions, tool calls, example input/output)
- **Context** it needs (which files, which APIs)

Claude Code's memory stores *facts* about you ("prefers bullet points"). Hermes stores *procedures* ("the research-filter-format workflow that produces bullet points the way you want them"). That's a meaningful difference. Facts inform the model; procedures get reused directly.

### The 5-tool-call rule

Skills don't auto-generate after every task — that'd be noisy. They generate when Hermes detects repetition: usually after five-plus tool calls on a pattern, or after a user correction that teaches something general. That's why on day one your skills directory is empty, and by day thirty you have 20+ skills running your life.

### What "Harness Engineering" actually means

Nous uses the phrase *Harness Engineering* a lot. It's the framing behind the whole product: the LLM is a replaceable component, and the real engineering work happens in the layers around it. There are five: instruction layer (how you talk to the model), constraint layer (what it's allowed to do), feedback layer (how errors flow back), memory layer (what persists), and orchestration layer (how multiple tools and calls are stitched together). Hermes is an opinionated implementation of those five layers. Swap the model, keep the harness.

---

## 8. Essential skills to install first

There are 643 community-contributed skills in the Hub (as of 2026-04-19). Don't try to install them all. Here are five that every Hermes user should have on day one.

### The 643-skill Hub

Run `hermes skills browse` to see the catalog. Skills come from four trust tiers:

- **Builtin** — ships with Hermes, can't be tampered with.
- **Official** — published by Nous, security-audited.
- **Trusted** — published by verified community members (OpenAI, Anthropic, VoltAgent, gstack, etc.).
- **Community** — everything else; scanned for security issues but read the source before installing.

### Five to install today

1. **LLM Wiki** (builtin) — Karpathy-style condensed reference for any topic. Feed it "transformers" and get a 2-minute primer. Great for ramping on anything Hermes encounters.
2. **gstack** (trusted) — browser automation, QA testing, and design review in one skill. Essential for anyone using Hermes to dogfood websites.
3. **OpenAI taps** (trusted) — expose OpenAI's function-calling primitives as Hermes tools. Useful even if you're not on an OpenAI model.
4. **Manim** (official) — generate mathematical animations from text. Surprisingly addictive for anyone who writes technical content.
5. **security-audit** (official) — scan a repo for common vulnerabilities. Use it before you ship anything public.

Install with: `hermes skills install <name>`

### How to browse the hub

```bash
hermes skills browse           # interactive browser
hermes skills search telegram  # keyword search
hermes skills info <name>      # inspect before installing
```

Every skill shows trust tier, author, description, and recent changes. Read those before running anything in the Community tier.

More picks in our curated list: **[Top Skills for Hermes Agent →](/lists/top-skills)**

---

## 9. Where to go next

You've installed Hermes, picked a model, shipped one workflow, and understand the learning loop. Here are three paths from here.

### Path 1 — Deeper into agents

Build a multi-agent team. One orchestrator, one researcher, one writer, one debugger, each with their own memory and skills. Hermes's delegation system makes this surprisingly clean. Start with our curated list: **[Multi-Agent Frameworks →](/lists/multi-agent-frameworks)**.

### Path 2 — Deeper into tooling

Build your own tools and skills. Learn the MCP protocol so your Hermes instance can talk to Notion, Linear, Figma, your internal APIs. This is where the Harness Engineering mental model really pays off. Start with **[Developer Tools →](/lists/developer-tools)**.

### Path 3 — Deeper into infra

Run Hermes in production for a team. Docker, systemd, managed cloud templates, Kubernetes. The community has packaged most of it. Start with **[Deployment Options →](/lists/deployment-options)**.

### Bookmark the Atlas

The handbook teaches you the fundamentals. The Atlas is where you find the specific tool you need for a specific job, ranked, filtered, and security-reviewed. **[Browse all 93 projects →](/)**.

And if you want the broader picture of where Hermes is right now — stars, PRs, key launches, what's next — read the quarterly report: **[The State of Hermes Agent — April 2026 →](/reports/state-of-hermes-april-2026)**.

---

## 10. FAQ

### Is Hermes Agent free?

Hermes itself is free and open-source (MIT licensed). You pay only for the model API you use. With some API model providers or a local Ollama model, your total cost can be $0. With Claude or GPT, you can easily spend $100+ per month depending on volume.

### Does it work on Windows?

Yes, via WSL2. Bare Windows isn't officially supported. Run `wsl --install` in PowerShell, then install Hermes from inside WSL as you would on Linux. The community runs Hermes on Windows happily this way.

### Can I run it fully offline?

Yes. Install Hermes, pair it with Ollama or LM Studio, and disconnect your network. Memory, skills, and cron all work offline. The catch: local models are weaker at tool calling, so complex multi-step workflows degrade. For offline *coding*, you're fine to an extent based on the capabilities of your local model. For offline *automation with many tool calls*, expect rough edges.

### Do I need a GPU?

No — if you use an API provider, any laptop handles Hermes. You need a GPU only if you're running the model locally. 

### Is my data sent anywhere?

Only to the provider you configure. Hermes has no telemetry, no analytics beacon, no phone-home. Memory, skills, and session logs live on your disk. If you pick a local model, your data never leaves your machine.

### Hermes vs Claude Code — do I have to pick one?

No. Most power users run both. Claude Code for coding inside a repo, Hermes for everything outside a repo (automation, monitoring, chat, cron, multi-repo research). They complement rather than compete. Full comparison: **[Hermes vs Claude Code →](/guide/vs-claude-code/)**.

### Will Hermes mess with my existing code?

No — not unless you point it at your codebase and ask it to. Hermes is additive: memory, skills, and logs live in `~/.hermes/`. It doesn't touch files outside directories you tell it to work in. If you want stricter sandboxing, enable the Docker backend and approval policies.

### What happens if it breaks something?

Hermes has approval policies that force confirmation on destructive operations (deletes, force-pushes, `rm -rf`). Turn them on — they're off by default so new users don't get prompt-bombed. If something goes wrong, every session is logged to `~/.hermes/sessions/` and reversible for most operations.

### Can a team share one Hermes agent?

Yes, via profiles. Each profile is an isolated agent instance with its own memory, sessions, skills, and cron state. Create a shared profile on a shared VPS, grant your team access via the messaging gateway allowlist, and you have a team agent.

### Can I use it with Ollama or LM Studio?

Yes. Run `hermes model`, pick "custom OpenAI-compatible endpoint," and point at your local server (usually `http://localhost:11434/v1` for Ollama). Everything works identically to the API providers, except tool-calling quality depends on the local model you pick — see [chapter 5](#5-pick-your-model).

### How do I update?

```bash
hermes update
```

Hermes self-updates. It tells you what changed, backs up your config, and applies the new version. Current release is v0.10.0 (as of 2026-04-19); the team ships roughly every two weeks.

---

## Where this handbook goes next

This is v1. We'll update it regularly. 

If something is wrong, unclear, or out of date, open an issue on [the Atlas repo](https://github.com/ksimback/hermes-ecosystem) or DM [@ksimback](https://x.com/ksimback). The handbook is the canonical beginner's reference and we want it to stay that way.

---

**Written by [Kevin Simback](https://x.com/ksimback)** · maintainer, Hermes Atlas

**Last updated:** 2026-04-20 · **Next scheduled refresh:** 2026-05-15

**Cited stats:**
- 104,791 GitHub stars, 14,957 forks, 5,762 open issues (source: `api.github.com/repos/NousResearch/hermes-agent`, as of 2026-04-20)
- 93 projects in the Hermes Atlas (as of 2026-04-19)
- 643 skills in the community Hub (as of 2026-04-19)

**Corrections and feedback:** [open an issue](https://github.com/ksimback/hermes-ecosystem/issues/new) or message on X.
