# How to Install Hermes Agent on a VPS (Always-On Server Setup)

The VPS/server install guide. Live version: https://hermesatlas.com/guide/install/vps/ — facts sourced from the official docs. Current release is v0.21.0 (as of 2026-08-31).

## TL;DR

A **$5 VPS (1 CPU, 1 GB RAM)** is enough to run Hermes as an always-on agent — Telegram/Discord bot, cron jobs, remote backend for Hermes Desktop — as long as the model is a hosted API (Nous Portal, Anthropic, OpenAI), not local inference. Recommended path: **Docker** (`nousresearch/hermes-agent`, Tier 1 on x86_64 and aarch64) with `--restart unless-stopped`; the image's s6 supervisor auto-restarts a crashed gateway. Direct install works too via the standard Linux one-liner.

**Connect over SSH, not your provider's browser console** — official docs warn that browser-based VPS consoles (Hetzner Cloud and others) mis-transmit characters like `:` and `@`, silently corrupting `docker run -v/-e` arguments and pasted API keys.

This guide covers Hermes Agent **v0.21.0**.

## Sizing

From the official Docker resource table: minimum 1 GB RAM / 1 core / 500 MB disk; recommended 2–4 GB RAM / 2 cores / 2 GB+ disk. Browser automation (Playwright/Chromium) is the most memory-hungry feature — a 1 GB box is fine if you skip it. Any glibc/systemd/FHS distro is likely to work; Ubuntu is the tested reference.

## Path A — Docker (recommended)

```
ssh root@<your-vps>
mkdir -p ~/.hermes
docker run -it --rm -v ~/.hermes:/opt/data nousresearch/hermes-agent setup
docker run -d --name hermes --restart unless-stopped \
  -v ~/.hermes:/opt/data -p 8642:8642 \
  nousresearch/hermes-agent gateway run
```

All state lives in the mounted `~/.hermes` — the container is stateless, so upgrading is `docker pull` + recreate (no `hermes update` in Docker, by design). One container can host multiple profiles (the officially recommended pattern), each gateway s6-supervised with per-profile rotated logs. Never point two gateway containers at one data directory.

## Path B — direct install (service user)

The standard installer, run as a dedicated unprivileged user: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` (add `--skip-browser` on headless boxes to skip Chromium). One-time admin step for browser tools: `sudo npx playwright install-deps chromium`. Then `hermes gateway setup` (installs a systemd user unit) and `sudo loginctl enable-linger <user>` so the gateway starts at boot and survives logout.

## Security: the part people get wrong

Exposing the dashboard or API server on a VPS means a non-loopback bind, and that **engages a mandatory auth gate** — unauthenticated public dashboards were the entry point for a real June 2026 attack campaign (internet scanners drove exposed agents into planting SSH-key backdoors), and the old `--insecure` escape hatch is now a deprecated no-op. Official guidance:

- **OAuth via Nous Portal** for anything reachable from the public internet.
- **Username/password** only on a trusted LAN or VPN (e.g. Tailscale).
- Or bind to `127.0.0.1` and reach the dashboard over an SSH tunnel — no public exposure at all.
- The gateway's OpenAI-compatible API server is off by default; enabling it beyond loopback requires `API_SERVER_KEY`.

## Using the VPS from your desktop and phone

- **Hermes Desktop** connects to the VPS as a remote gateway: keep `hermes serve` running on the VPS (systemd), then add it under Settings → Gateways in the app — OAuth (Nous Portal) is the preferred provider for a VPS backend. One connection serves every profile on the box.
- **Phone**: configure the messaging gateway (`hermes gateway setup`) and talk to your agent over Telegram/Discord/WhatsApp — the reason most people put Hermes on a VPS in the first place.

## FAQ

**How small a VPS can run Hermes Agent?** 1 GB RAM / 1 core is the documented minimum (without browser tools); 2–4 GB recommended. The typical $5 tier works with a hosted model API.

**Which provider should I use?** Any standard Ubuntu/Debian VPS works — Hermes has no provider-specific requirements. Whatever you pick, do the install over SSH: official docs warn that browser-based VPS consoles (e.g. Hetzner's) corrupt special characters in pasted commands.

**Docker or direct install on a VPS?** Docker for supervised auto-restart and clean image-based upgrades; direct install if you want `hermes update` and the lightest footprint.

**Is it safe to expose the Hermes dashboard on a VPS?** Only behind the mandatory auth gate — OAuth (Nous Portal) for public reachability; username/password strictly for LAN/VPN; or keep it loopback-only behind an SSH tunnel. `--insecure` no longer bypasses anything.

**Can Hermes Desktop connect to my VPS?** Yes — run `hermes serve` on the VPS and add it as a remote gateway in Desktop's Settings → Gateways, protected by OAuth.

**How do I update Hermes on the VPS?** Docker: `docker pull nousresearch/hermes-agent:latest`, then recreate the container (data persists in `~/.hermes`). Direct install: `hermes update`.
