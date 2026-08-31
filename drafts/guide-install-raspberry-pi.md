# How to Install Hermes Agent on a Raspberry Pi (4 & 5)

The Raspberry Pi install guide. Live version: https://hermesatlas.com/guide/install/raspberry-pi/ — facts sourced from the official docs. Current release is v0.21.0 (as of 2026-08-31).

## TL;DR

Yes, Hermes Agent runs on a Raspberry Pi — there's no Pi-specific build because none is needed: **Linux on aarch64 is Tier 1**, and so is the official Docker image on aarch64. A Pi 4 or Pi 5 with **4+ GB RAM** running a **64-bit OS** (Raspberry Pi OS 64-bit or Ubuntu Server) is the sweet spot. Two install paths:

1. **Direct install** (simplest): the standard Linux one-liner on Raspberry Pi OS 64-bit — `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`.
2. **Docker** (best for always-on): `docker run` the official `nousresearch/hermes-agent` image (published for aarch64), with s6-supervised gateway auto-restart.

The practical constraint isn't Hermes — it's the model. Pair the Pi with a hosted API (Nous Portal, Anthropic, OpenAI) and the agent host stays lightweight; don't plan on running local LLM inference on the Pi itself.

This guide covers Hermes Agent **v0.21.0**.

## Hardware requirements

- **64-bit (aarch64) OS is required** — official support is for aarch64 Linux; use Raspberry Pi OS **64-bit** or Ubuntu Server 64-bit, not a 32-bit (armv7) image.
- **Pi 4 / Pi 5 with 4 GB+ RAM recommended.** Docker minimums from the official docs: 1 GB RAM / 1 core, 2–4 GB recommended — browser automation (Playwright/Chromium) is the most memory-hungry feature; skip it (`--skip-browser`) on smaller Pis.
- A Pi 3 technically has an aarch64 CPU but only 1 GB RAM — enough for a gateway-only setup without browser tools, but tight. Pi Zero–class boards are not realistic hosts.
- Disk: ~200 MB for the install, plus 500 MB–2 GB+ as sessions and skills grow. Use a quality SD card or, better, USB/NVMe boot.

## Path 1 — direct install on Raspberry Pi OS

Raspberry Pi OS 64-bit is Debian-based, so the Pi is just a Tier-1 Linux aarch64 box:

```
sudo apt install -y git curl xz-utils
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes version   # prints v0.21.0 (or newer)
```

For an always-on Telegram/Discord bot: `hermes gateway setup` (offers a systemd user unit) and `sudo loginctl enable-linger <user>` so the gateway survives logout and starts at boot. Headless Pi? Add `--skip-browser` to the installer to skip Chromium entirely.

## Path 2 — Docker (recommended for set-and-forget)

The official image is published for aarch64 and supervises the gateway with s6 (auto-restart on crash):

```
mkdir -p ~/.hermes
docker run -it --rm -v ~/.hermes:/opt/data nousresearch/hermes-agent setup
docker run -d --name hermes --restart unless-stopped \
  -v ~/.hermes:/opt/data -p 8642:8642 \
  nousresearch/hermes-agent gateway run
```

Updating is `docker pull` + recreate (Docker installs intentionally don't support `hermes update`). Never run two gateway containers against the same data directory.

## What people actually run on Pis

Community reports in our user-story corpus include a Raspberry Pi 5 running Hermes 24/7 as an always-on personal agent and Pi-hosted gateways on residential IPs. Treat these as community anecdotes rather than official benchmarks — but they match what the Tier-1 aarch64 support implies.

## FAQ

**Can Hermes Agent run on a Raspberry Pi 5?** Yes — aarch64 Linux and aarch64 Docker are both Tier 1. A Pi 5 (4 or 8 GB) handles the agent, gateway, and cron comfortably with a hosted model API.

**Can it run on a Raspberry Pi 4?** Yes — same paths. Prefer the 4 GB or 8 GB model; on 2 GB, skip browser tools.

**What about a Raspberry Pi 3?** Borderline: it's aarch64 but has 1 GB RAM — the documented Docker minimum with no headroom. Gateway-only without browser tools can work; expect swap pressure.

**Do I need a 64-bit OS?** Yes. Official support targets aarch64; install Raspberry Pi OS 64-bit or Ubuntu Server 64-bit, not the 32-bit image.

**Can the Pi run the model locally?** Not realistically — pair Hermes on the Pi with a hosted API (Nous Portal, Anthropic, OpenAI) or a model server on beefier hardware on your LAN.

**Docker or direct install on the Pi?** Docker for set-and-forget uptime (supervised auto-restart, clean upgrades by pulling a new image); direct install for the lightest footprint and `hermes update`.
