# How to Install Hermes Agent on macOS (Apple Silicon)

The macOS install guide. Live version: https://hermesatlas.com/guide/install/macos/ — facts sourced from the official docs. Current release is v0.21.0 (as of 2026-08-31).

## TL;DR

Two supported paths on a Mac, both Tier 1 on **Apple Silicon** (M1–M4):

1. **Hermes Desktop installer** (recommended by Nous): download from the official site and run it — you get the desktop app and the CLI in one shot, sharing the same config and data.
2. **CLI-only curl install**: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`, then `source ~/.zshrc` and run `hermes`.

Two paths that are explicitly **unsupported**: `brew install hermes-agent` and `pip`/`uv tool install` — the official platform-support page says they may be broken now, may break more, and compat code can be removed at any point.

This guide covers Hermes Agent **v0.21.0**.

## Intel Macs are unsupported

The official support matrix lists **macOS on Intel (x86) processors as unsupported** — only Apple Silicon is Tier 1. If you're on an Intel Mac, the practical alternatives are running Hermes on a Linux box/VPS you SSH into, or the Docker image (Tier 1 on x86_64) on other hardware. Don't expect the installer to keep working on Intel.

## Prerequisites

Just **Git** (`git --version`). The installer handles the rest: `uv`, Python 3.11 (no sudo), Node.js 26 (existing Node 22.22+/24.11+/26+ is used as-is), ripgrep, and ffmpeg. For the desktop app it also needs a working compiler toolchain to build native modules.

## Install and verify

```
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.zshrc     # macOS default shell since Catalina
hermes version      # prints v0.21.0 (or newer)
hermes doctor       # health check — every line should be green
```

Code lands in `~/.hermes/hermes-agent/`, the `hermes` command at `~/.local/bin/hermes`, and your data (config, keys, sessions, skills, memory) in `~/.hermes/`.

First run: `hermes` starts the provider wizard. Fastest path is `hermes setup --portal` — one Nous Portal login covers 300+ models plus the Tool Gateway. Already running Hermes elsewhere? `hermes import` restores a full backup.

If you installed CLI-only and want the app later: `hermes desktop` installs and launches Hermes Desktop against your existing config.

## FAQ

**Does Hermes work on Apple Silicon (M1, M2, M3, M4)?** Yes — macOS on Apple Silicon is Tier 1. The installer pulls native arm64 binaries; no Rosetta.

**Does Hermes work on Intel Macs?** No — Intel Macs are explicitly listed as unsupported in the official platform matrix. Use a Linux machine, a VPS, or Docker on other hardware instead.

**Can I install Hermes with Homebrew?** No — `brew install hermes-agent` is an unsupported path per the official docs. Use the Desktop installer or the curl one-liner.

**Should I use the Desktop installer or the curl install?** Desktop installer if you want the app (Nous recommends it as the easy path); curl if you're terminal-only. They share the same agent core, config, and data — and `hermes desktop` upgrades a CLI install to the app any time.

**Is a Mac mini a good always-on Hermes host?** An Apple Silicon Mac mini works well — it's a Tier 1 platform and popular for exactly this. For headless always-on setups, compare the Docker/VPS route in our modes guide.

**How much disk space does it need?** Roughly 200 MB for a fresh install; budget another 100–500 MB for sessions, skills, and memory as you use it.
