# How to Run Hermes Agent: Desktop vs CLI vs Docker/VPS vs Bot Gateway

The decision guide to every way of running Hermes Agent. Live version: https://hermesatlas.com/guide/modes/ — facts sourced from the official docs. Current release is v0.21.0 (as of 2026-08-31).

## TL;DR

You don't choose a front-end — you choose where the agent lives. Hermes Desktop, the CLI/TUI, and the web dashboard are front-ends to the same agent core: same config, API keys, sessions, skills, and memory. The official docs say "Pick whichever fits the moment. They share state." The real decision is where the agent process runs: your own machine (simplest), a Docker container on a VPS or home server (always-on), managed Hermes Cloud (hosted), or your phone via Termux (best-effort).

## The front-ends

- **Hermes Desktop** — native app for macOS, Windows, Linux; same agent core as the CLI ("not a separate product or a lightweight clone"). Best default for most people: multi-session chat windows, Bot Mode roster, Memory Graph, Quick Entry global hotkey, and multi-connection to several remote gateways/VPS/Cloud instances at once. If you run the CLI, `hermes desktop` launches the app against your existing config.
- **CLI / TUI** — two terminal front-ends over one SQLite session store. The TUI (`hermes --tui`, Node.js ≥ 20) is officially "the recommended way to run Hermes interactively." Power features: worktree-isolated parallel agents (`hermes -w`), background sessions (`/bg`), shell passthrough (`!cmd`), skill slash-commands.
- **Web dashboard** — `hermes dashboard`, a machine-level browser admin panel at 127.0.0.1:9119 managing every profile; for local use no data leaves localhost. Its optional Chat tab embeds the TUI via pseudo-terminal (POSIX PTY — WSL2 rather than native Windows).

## Where the agent lives

- **Your machine (default):** install.sh (macOS/Linux/WSL2) or install.ps1/Desktop installer (Windows). Simplest; updates via `hermes update`. The agent sleeps when your laptop does — cron and bots included.
- **Docker on a VPS/home server (always-on):** official image `nousresearch/hermes-agent` (x86_64 + aarch64, Tier 1) with s6-overlay supervising gateway + dashboard (auto-restart). One container can host several profiles (now the recommended pattern). Minimum 1GB/1 core; 2–4GB with browser tools. Docker installs do NOT support `hermes update` — pull a new image. Never point two gateway containers at one data dir (session/memory corruption).
- **Security on VPS:** binding the dashboard/backend to a non-loopback address engages a mandatory auth gate; `--insecure` is a deprecated no-op. In June 2026 unauthenticated public dashboards were the entry point for a real campaign that planted SSH-key backdoors via MCP-config persistence. Official guidance: OAuth via Nous Portal for anything public; username/password only on a trusted LAN or VPN (Tailscale).
- **Managed Hermes Cloud:** hosted instances via portal.nousresearch.com/cloud — create/start/stop/destroy from the Portal or via its MCP server. The convenience path; docs are thinner than Docker's. Desktop connects to Cloud instances like any remote gateway.
- **Your phone (Termux, Tier 2):** tested bundle is CLI + cron + background terminal + best-effort Telegram gateway + MCP + memory. Android may suspend background jobs, so gateway persistence is best-effort; voice and full browser bootstrap are unavailable. Most people instead pair a VPS gateway with Telegram on the phone.

## Bots and messaging

"Bot mode" is the messaging gateway: one background process connecting to all configured platforms — Telegram, Discord, Slack, Google Chat, WhatsApp, Signal, SMS and 15+ more, each with different feature support (voice/images/files/threads/streaming) per the official platform comparison. `hermes gateway setup` is the entry point from any install mode. In Desktop, Bot Mode is built in and on by default; a bot is a Hermes profile with CLI parity (`hermes -p <bot> chat`).

## Platform support tiers (official)

- **Tier 1** (fixes take first priority; installs/updates should never break): macOS Apple Silicon, Windows 10/11 native (x86_64 + aarch64), Linux & WSL2, Docker.
- **Tier 2** (best effort; releases may break them): Android/Termux, Nix — Nix "breaks often due to node.js packaging woes."
- **Unsupported** (may break anytime; PRs not accepted): AUR, Intel Macs, pip/uv tool installs, brew.

## Windows: native or WSL2?

Both Tier 1. Pick WSL2 if: you want the dashboard's embedded terminal tab (POSIX PTY, WSL2-only), you do POSIX-heavy development and want Hermes on the same Linux filesystem as your tools, or you already maintain WSL2. Native is fine or better otherwise: chat, gateway, cron, browser tool, and MCP all run natively, and you avoid crossing the WSL↔Windows boundary for files and URLs.

## Recommendations

- Just trying Hermes → Hermes Desktop on a Tier-1 machine.
- Terminal person → install.sh + `hermes --tui`.
- Always-on bot → Docker on a small VPS (or Hermes Cloud), dashboard behind OAuth or a tailnet; manage from Desktop remote connections.
- Phone → Telegram against a VPS gateway first; Termux only for phone-local execution.
- NixOS → extensive official guide, still Tier 2.

## FAQ

**Does Hermes Agent have a desktop app?** Yes — Hermes Desktop for macOS, Windows, Linux; same agent core as the CLI. Install from the official page or run `hermes desktop`.

**Desktop or CLI?** Not either/or — they share state. Desktop adds visual multi-session and bot management; the TUI is the officially recommended interactive terminal experience.

**Raspberry Pi / home server?** Yes — Docker is Tier 1 on aarch64. 1GB/1 core minimum (2–4GB with browser tools); update by pulling a new image.

**Android?** Yes via Termux (Tier 2): CLI, cron, MCP, memory, best-effort Telegram gateway. Android suspends background jobs, so not an always-on host.

**Need a VPS for a Telegram/Discord bot?** No — the gateway runs anywhere including Desktop's Bot Mode — but a VPS or Hermes Cloud is right once the bot must outlive your laptop's lid.

**Safe to expose the dashboard on a VPS?** Only behind the auth gate: OAuth for public reachability, username/password strictly LAN/VPN. Unauthenticated dashboards were exploited in June 2026; `--insecure` is now a no-op.

**Windows native or WSL2?** Native for most; WSL2 for the dashboard's embedded terminal or a real POSIX dev environment.
