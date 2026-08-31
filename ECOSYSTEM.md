# Hermes Atlas

> The community-curated map of every tool, skill, plugin, and integration for [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com). Hermes Agent is an autonomous, self-improving AI agent with persistent memory, auto-generated skills, and multi-platform deployment — MIT licensed, 57k+ stars.
>
> **Live site:** [hermesatlas.com](https://hermesatlas.com) · **Last updated:** 2026-04-11 · **Hermes version:** 0.8.0

---

## How to Read This Map

Each entry includes a one-line description, link, star count, and maturity indicator:
- **Production** — Stable, actively maintained, safe to depend on
- **Beta** — Functional but evolving, expect breaking changes
- **Experimental** — Early-stage, interesting concept, use with caution

Repos are filtered for quality: we exclude unfinished projects, personal experiments, 0-star repos, and anything that doesn't add clear value to the Hermes ecosystem. Repos marked with `official` are by Nous Research.

---

## Table of Contents

1. [Core & Official](#core--official)
2. [Workspaces & GUIs](#workspaces--guis)
3. [Skills & Skill Registries](#skills--skill-registries)
4. [Plugins & Extensions](#plugins--extensions)
5. [Memory & Context](#memory--context)
6. [Multi-Agent & Orchestration](#multi-agent--orchestration)
7. [Deployment & Infrastructure](#deployment--infrastructure)
8. [Integrations & Bridges](#integrations--bridges)
9. [Developer Tools & Utilities](#developer-tools--utilities)
10. [Domain Applications](#domain-applications)
11. [Guides & Documentation](#guides--documentation)
12. [Ecosystem Resources](#ecosystem-resources)

---

## Core & Official

The foundational repos maintained by Nous Research.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) `official` | The core agent — self-improving AI with persistent memory, 47 tools, 14 messaging platforms, and 6 execution backends | 43,724 | Production |
| [NousResearch/hermes-agent-self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution) `official` | Evolutionary self-improvement for Hermes — optimizes skills, prompts, and code using DSPy + GEPA | 778 | Beta |
| [NousResearch/hermes-paperclip-adapter](https://github.com/NousResearch/hermes-paperclip-adapter) `official` | Run Hermes as a managed employee in Paperclip company systems | 663 | Beta |
| [NousResearch/autonovel](https://github.com/NousResearch/autonovel) `official` | Autonomous novel-writing pipeline generating 100k+ word manuscripts | 401 | Beta |
| [NousResearch/Hermes-Function-Calling](https://github.com/NousResearch/Hermes-Function-Calling) `official` | Function calling examples and training data for Hermes LLM models | 1,249 | Production |

---

## Workspaces & GUIs

Web-based and desktop interfaces that wrap Hermes with visual UIs.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [outsourc-e/hermes-workspace](https://github.com/outsourc-e/hermes-workspace) | Native web workspace — chat, terminal, memory browser, skills manager, and inspector panel | 830 | Beta |
| [Euraika-Labs/pan-ui](https://github.com/Euraika-Labs/pan-ui) | Self-hosted AI workspace for Hermes with chat, skills, extensions, memory, and runtime controls | 26 | Experimental |
| [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop) | Desktop application wrapper for Hermes Agent | 65 | Beta |
| [sanchomuzax/hermes-webui](https://github.com/sanchomuzax/hermes-webui) | Process monitoring and configuration dashboard for Hermes | 57 | Beta |

---

## Skills & Skill Registries

Skills are on-demand knowledge documents following the [agentskills.io](https://agentskills.io) open standard. These repos provide ready-made skills or platforms for discovering them.

### Skill Libraries

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 754 structured cybersecurity skills mapped to MITRE ATT&CK, NIST CSF 2.0, ATLAS, D3FEND & NIST AI RMF | 4,132 | Production |
| [conorbronsdon/avoid-ai-writing](https://github.com/conorbronsdon/avoid-ai-writing) | Audits and rewrites content to eliminate detectable AI writing patterns | 759 | Production |
| [wondelai/skills](https://github.com/wondelai/skills) | Cross-platform skills library for Claude Code and agentskills.io-compatible agents | 480 | Production |
| [smartcontractkit/chainlink-agent-skills](https://github.com/smartcontractkit/chainlink-agent-skills) | Oracle network and smart contract interaction skills (agentskills.io spec) | 85 | Beta |
| [black-forest-labs/skills](https://github.com/black-forest-labs/skills) | Official FLUX image generation skills — prompting guidelines and API integration | 44 | Production |
| [Agents365-ai/drawio-skill](https://github.com/Agents365-ai/drawio-skill) | Generate draw.io diagrams from natural language descriptions | 131 | Beta |
| [tlehman/litprog-skill](https://github.com/tlehman/litprog-skill) | Literate programming skill — weave code and documentation across agents | 81 | Beta |
| [Romanescu11/hermes-skill-factory](https://github.com/Romanescu11/hermes-skill-factory) | Meta-skill plugin that watches workflows and auto-generates reusable skills | 34 | Beta |
| [tiann/execplan-skill](https://github.com/tiann/execplan-skill) | Complex multi-step task execution with checkpoints and recovery | — | Beta |
| [ReinaMacCredy/maestro](https://github.com/ReinaMacCredy/maestro) | Multi-step skill orchestration and chaining | — | Beta |
| [esaradev/icarus-plugin](https://github.com/esaradev/icarus-plugin) | Self-memory and replacement models — remember your work, train your replacement | 51 | Beta |
| [DougTrajano/pydantic-ai-skills](https://github.com/DougTrajano/pydantic-ai-skills) | Type-safe schema validation for agentskills.io skills | — | Beta |
| [armelhbobdad/bmad-module-skill-forge](https://github.com/armelhbobdad/bmad-module-skill-forge) | Converts existing repos into agentskills.io format | — | Beta |
| [cablate/Agentic-MCP-Skill](https://github.com/cablate/Agentic-MCP-Skill) | MCP client with skills validation layer | — | Beta |
| [PederHP/skillsdotnet](https://github.com/PederHP/skillsdotnet) | C# / .NET implementation of the agentskills.io standard | — | Experimental |

### Skill Registries & Discovery

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [chigwell/skilldock.io](https://github.com/chigwell/skilldock.io) | Registry of reusable AI skills based on AgentSkills specification | 50 | Production |
| [amanning3390/hermeshub](https://github.com/amanning3390/hermeshub) | Community skill browsing, search, and one-click installation | — | Beta |

---

## Plugins & Extensions

Plugins extend Hermes with new tools, data sources, or behaviors at the framework level.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [42-evey/hermes-plugins](https://github.com/42-evey/hermes-plugins) | Goal management, inter-agent bridge, model selection, and cost control plugins | 16 | Beta |
| [42-evey/evey-bridge-plugin](https://github.com/42-evey/evey-bridge-plugin) | Claude Code ↔ Hermes context sharing bridge | — | Beta |
| [robbyczgw-cla/hermes-web-search-plus](https://github.com/robbyczgw-cla/hermes-web-search-plus) | Multi-provider web search routing (fallback across search APIs) | — | Beta |
| [FahrenheitResearch/hermes-weather-plugin](https://github.com/FahrenheitResearch/hermes-weather-plugin) | Professional weather data with NWS imagery and forecasts | — | Beta |
| [nativ3ai/hermes-payguard](https://github.com/nativ3ai/hermes-payguard) | Safe USDC and x402 payment handling for agents | — | Experimental |
| [raulvidis/hermes-cloudflare](https://github.com/raulvidis/hermes-cloudflare) | Headless browsing via Cloudflare Workers | — | Experimental |

---

## Memory & Context

Extensions to Hermes's built-in memory system — external providers, context engines, and recall tools.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight) | Long-term memory provider with retain/recall/reflect workflows | 8,362 | Production |
| [elkimek/honcho-self-hosted](https://github.com/elkimek/honcho-self-hosted) | Self-hosted Honcho memory backend for cross-session persistence | 126 | Beta |
| [yoloshii/ClawMem](https://github.com/yoloshii/ClawMem) | On-device memory and context engine for agents | 86 | Beta |
| [plur-ai/plur](https://github.com/plur-ai/plur) | Shared memory layer with open engram YAML format for multi-agent systems | 31 | Beta |
| [amanning3390/flowstate-qmd](https://github.com/amanning3390/flowstate-qmd) | Anticipatory memory with RAG and vector search | — | Experimental |
| [greyhaven-ai/autocontext](https://github.com/greyhaven-ai/autocontext) | Recursive self-improving context harness — helps agents succeed on complex tasks | 711 | Beta |

---

## Multi-Agent & Orchestration

Frameworks for running multiple Hermes agents or coordinating agent swarms.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) | Self-hosted AI agent orchestration — dispatch tasks, run multi-agent workflows, monitor spend | 3,875 | Beta |
| [swarmclawai/swarmclaw](https://github.com/swarmclawai/swarmclaw) | Build autonomous AI agent swarms with orchestration, skills, and multiple model providers | 285 | Beta |
| [1ilkhamov/opencode-hermes-multiagent](https://github.com/1ilkhamov/opencode-hermes-multiagent) | 17 specialized agents with structured communication protocols | — | Beta |
| [Abruptive/Ankh.md](https://github.com/Abruptive/Ankh.md) | TAW Agent × Hermes swarm framework for multi-agent collaboration | 25 | Experimental |
| [runtimenoteslabs/gladiator](https://github.com/runtimenoteslabs/gladiator) | Autonomous AI companies competing for GitHub stars — agent-vs-agent arena | 29 | Experimental |

---

## Deployment & Infrastructure

Docker images, deployment templates, and infrastructure tooling for running Hermes in production.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [xmbshwll/hermes-agent-docker](https://github.com/xmbshwll/hermes-agent-docker) | Minimal Docker sandbox image for Hermes | — | Beta |
| [0xrsydn/nix-hermes-agent](https://github.com/0xrsydn/nix-hermes-agent) | Nix package and NixOS module for reproducible Hermes deployment | — | Beta |
| [numtide/llm-agents.nix](https://github.com/numtide/llm-agents.nix) | Nix packages for AI coding agents including Hermes | 967 | Production |
| [JackTheGit/hermes-autonomous-server](https://github.com/JackTheGit/hermes-autonomous-server) | Headless systemd deployment for always-on Hermes | — | Experimental |
| [TheAiSingularity/hermesclaw](https://github.com/TheAiSingularity/hermesclaw) | Hermes Agent sandboxed with hardware-level enforcement | 16 | Experimental |

---

## Integrations & Bridges

Connect Hermes to external platforms, services, and ecosystems.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [teknium1/hermes-miniverse](https://github.com/teknium1/hermes-miniverse) | Bridge Hermes to Miniverse pixel worlds — agent embodiment in virtual environments | 8 | Experimental |
| [raulvidis/hermes-android](https://github.com/raulvidis/hermes-android) | Android device bridge with Python toolset for mobile automation | — | Beta |
| [gizdusum/hermes-blockchain-oracle](https://github.com/gizdusum/hermes-blockchain-oracle) | Solana on-chain analytics MCP server for Hermes | — | Experimental |
| [Ridwannurudeen/hermes-council](https://github.com/Ridwannurudeen/hermes-council) | Adversarial multi-perspective MCP server for decision-making | — | Experimental |

---

## Developer Tools & Utilities

Tools that make developing with, debugging, or optimizing Hermes easier.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [junhoyeo/tokscale](https://github.com/junhoyeo/tokscale) | Token usage tracker for Claude Code, OpenClaw, Hermes, and other agents | 1,690 | Production |
| [joeynyc/hermes-skins](https://github.com/joeynyc/hermes-skins) | Community CLI skins and themes for Hermes terminal UI | 76 | Beta |
| [hermes-labs-ai/lintlang](https://github.com/hermes-labs-ai/lintlang) | Static linting for agent configs with HERM v1.1 scoring | — | Beta |
| [0xNyk/openclaw-to-hermes](https://github.com/0xNyk/openclaw-to-hermes) | Migration tool from OpenClaw to Hermes Agent | 21 | Beta |
| [unmodeled-tyler/vessel-browser](https://github.com/unmodeled-tyler/vessel-browser) | AI-native browser built for autonomous agent control via MCP | 44 | Experimental |
| [42-evey/evey-setup](https://github.com/42-evey/evey-setup) | One-command Hermes stack setup with 29 pre-configured plugins | — | Beta |
| [aivrar/portable-hermes-agent](https://github.com/aivrar/portable-hermes-agent) | Windows desktop app bundling Hermes with 100 tools | — | Beta |
| [AlexAI-MCP/hermes-CCC](https://github.com/AlexAI-MCP/hermes-CCC) | Hermes Agent ported to Claude Code Channel — 46 native skills, no OAuth, no external process | 56 | Beta |
| [howdymary/hermes-agent-metaharness](https://github.com/howdymary/hermes-agent-metaharness) | Meta-harness implementation for Hermes Agent orchestration | 46 | Beta |

---

## Domain Applications

Purpose-built agents and workflows powered by Hermes for specific use cases.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [ucsandman/DashClaw](https://github.com/ucsandman/DashClaw) | Decision infrastructure with guard policies and risk assessment for agents | 204 | Beta |
| [bigph00t/hermescraft](https://github.com/bigph00t/hermescraft) | Minecraft companion agent with persistent memory and world awareness | — | Beta |
| [rodmarkun/anihermes](https://github.com/rodmarkun/anihermes) | Anime media server with natural language interface powered by Hermes | — | Beta |
| [Christabel337/job-scout-agent](https://github.com/Christabel337/job-scout-agent) | Autonomous job hunting — scans listings, writes cover letters, tracks applications | — | Beta |
| [JackTheGit/hermes-ai-infrastructure-monitoring-toolkit](https://github.com/JackTheGit/hermes-ai-infrastructure-monitoring-toolkit) | Infrastructure monitoring, alerting, and cost forecasting | — | Beta |
| [hxsteric/mercury](https://github.com/hxsteric/mercury) | Multi-chain blockchain cash flow analyzer | — | Beta |
| [Lethe044/hermes-incident-commander](https://github.com/Lethe044/hermes-incident-commander) | Production incident detection and self-healing workflows | — | Beta |
| [bryercowan/hermes-embodied](https://github.com/bryercowan/hermes-embodied) | Self-improving robotics via VLA model fine-tuning | — | Experimental |

---

## Guides & Documentation

Community-created documentation, tutorials, and setup guides.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [alchaincyf/hermes-agent-orange-book](https://github.com/alchaincyf/hermes-agent-orange-book) | Hermes Agent practical guide — Orange Book series (Chinese) | 315 | Beta |
| [OnlyTerp/hermes-optimization-guide](https://github.com/OnlyTerp/hermes-optimization-guide) | Performance optimization guide for Hermes deployments | 51 | Beta |
| [metantonio/hermes-wsl-ubuntu](https://github.com/metantonio/hermes-wsl-ubuntu) | Step-by-step WSL2 Ubuntu setup guide for Windows users | — | Production |
| [mudrii/hermes-agent-docs](https://github.com/mudrii/hermes-agent-docs) | Community documentation covering deployment patterns and v0.2.0+ workflows | — | Beta |
| [martymcenroe/HermesWiki](https://github.com/martymcenroe/HermesWiki) | Community wiki with deployment patterns and recipes | — | Beta |

---

## Ecosystem Resources

Meta-resources for navigating the Hermes ecosystem.

| Resource | Description | Link |
|:---------|:------------|:-----|
| Official Documentation | Comprehensive setup, configuration, and API reference | [hermes-agent.nousresearch.com/docs](https://hermes-agent.nousresearch.com/docs) |
| Nous Research Discord | Community support and discussion | [discord.gg/NousResearch](https://discord.gg/NousResearch) |
| awesome-hermes-agent | Curated community list of skills, tools, and integrations (898 stars) | [github.com/0xNyk/awesome-hermes-agent](https://github.com/0xNyk/awesome-hermes-agent) |
| agentskills.io | Open standard for cross-platform agent skills | [agentskills.io](https://agentskills.io) |
| Nous Portal | Official inference endpoint and subscription service | [portal.nousresearch.com](https://portal.nousresearch.com) |
| Skills Hub (built-in) | Browse and install skills via `hermes skills browse` | CLI: `hermes skills browse` |
| skilldock.io | Third-party registry of reusable AI skills | [github.com/chigwell/skilldock.io](https://github.com/chigwell/skilldock.io) |

---

## Ecosystem Statistics

| Metric | Count |
|:-------|------:|
| Core repos (Nous Research) | 6 |
| Community repos (quality-filtered) | 75+ |
| Total ecosystem stars | 60,000+ |
| Skill libraries | 15+ |
| Plugins | 7+ |
| Deployment templates | 7 |
| Messaging platforms supported | 14 |
| LLM providers supported | 18+ |
| Terminal backends | 6 |
| Built-in tools | 47 |

---

## Forks & Derivatives

Notable forks that add significant functionality beyond the base Hermes agent.

| Repository | Description | Stars | Maturity |
|:-----------|:------------|------:|:---------|
| [nativ3ai/hermes-agent-camel](https://github.com/nativ3ai/hermes-agent-camel) | Hermes with integrated CaMeL trust boundaries for safer autonomous execution | 12 | Beta |
| [kaminocorp/hermes-alpha](https://github.com/kaminocorp/hermes-alpha) | Cloud-deployed Hermes with pre-configured templates and managed infrastructure | — | Beta |
| [beardthelion/hermes-skill-distillation](https://github.com/beardthelion/hermes-skill-distillation) | Fine-tuning trajectory generation from Hermes skill executions | — | Experimental |

---

## Security Notes

All community repos with 25+ stars were reviewed for obfuscated code, credential harvesting, typosquatting, supply chain attacks, crypto mining, and excessive permissions. **No repos were found to be malicious.** Full report: [`repos/security-review.md`](repos/security-review.md).

Five repos received WARN status (not for malicious behavior, but for patterns requiring user caution):

| Repo | Concern | Recommendation |
|:-----|:--------|:---------------|
| swarmclawai/swarmclaw | README could not be fully audited | Inspect source before use |
| AlexAI-MCP/hermes-CCC | PowerShell `install.ps1` + curl-pipe-bash installer | Inspect install scripts before running |
| unmodeled-tyler/vessel-browser | curl-pipe-bash installer with broad scope | Download and inspect `install.sh` first |
| runtimenoteslabs/gladiator | Hardcoded dev DB creds, 0.0.0.0 binding without auth | Not recommended for production use without hardening |
| joeynyc/hermes-skins | README could not be fully audited | Low risk (visual themes only), but inspect before use |

**General advice:** For any repo with a `curl ... | bash` installer, download the script first and review it before executing.

---

## About This Map

This ecosystem map was compiled on 2026-04-08 by researching the [Hermes Agent GitHub repository](https://github.com/NousResearch/hermes-agent), its [official documentation](https://hermes-agent.nousresearch.com/docs), the [awesome-hermes-agent](https://github.com/0xNyk/awesome-hermes-agent) curated list, and comprehensive GitHub API searches across topics, names, and README references.

**Filtering criteria:**
- Must be specifically built for or integrated with Hermes Agent
- Created after July 22, 2025 (Hermes repo creation date) — except pre-existing tools that later added Hermes support
- Not a personal pet project or homework assignment
- Shows genuine effort and adds value to the ecosystem
- Excludes direct forks without meaningful changes
- Security-reviewed for obvious red flags

**Contributing:** Found a repo that should be listed? The [awesome-hermes-agent](https://github.com/0xNyk/awesome-hermes-agent) list accepts community PRs.
