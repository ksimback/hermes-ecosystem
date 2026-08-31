# Hermes Desktop: The Complete Guide — Install, Features, Plugins

The Hermes Desktop guide. Live version: https://hermesatlas.com/guide/desktop/ — facts sourced from the official Hermes Desktop docs. Current release is v0.20.6 (as of 2026-08-27).

## TL;DR

Hermes Desktop is not a separate product — it is the same agent as the CLI with a native UI. Official docs: same config, same API keys, same sessions, same skills, same memory; "anything you do here shows up there." Runs on macOS, Windows, and Linux; launches its own backend (a `hermes serve` process) so it never requires separate server setup. Best starting point for most new users.

## Install (macOS · Windows · Ubuntu/Linux)

- Fresh install: download from the official Hermes Desktop page. macOS is Apple Silicon only (Intel Macs are officially unsupported); Windows 10/11 x86_64 and aarch64; Linux builds target mainstream glibc distros (the team tests latest Ubuntu).
- Already run the CLI? Type `hermes desktop` — the app picks up your existing config, keys, sessions, and skills. Nothing to migrate. On Ubuntu, this route is usually smoother than hunting a distro package.

## Desktop-only capabilities

- Multi-session, multi-window chat with live tool activity, drag-and-drop attachments, side-by-side preview rail, queue editing, find-in-transcript.
- Bot Mode: a roster of named agent profiles (each bot IS a Hermes profile), on by default, with group rooms and CLI parity (`hermes -p <bot> chat`).
- Memory Graph, HUD floating mode, Quick Entry global hotkey.
- Multi-connection: attach to several backends at once — local agent plus remote gateways on a VPS, home server, or managed Hermes Cloud instances.
- Per-session YOLO toggle and a live context-usage meter with token breakdown by category.

## Plugins and skills

Desktop uses the same skills, plugins, and MCP servers as every other Hermes surface — there is no separate desktop plugin format. Anything installed for the CLI is live in the app; Bot Mode profiles inherit the same capabilities. Curated picks: the Hermes Skills Hub (hermesatlas.com/skills/); community plugins & extensions in the ecosystem catalog (hermesatlas.com/ecosystem/); memory setups in the Memory Guidebook (hermesatlas.com/guide/memory/).

## Connecting to a VPS or cloud instance

"Remote backend" means a `hermes serve` process you keep running on the remote machine (systemd/tmux) — the app attaches to it; it does not start it for you. Non-loopback binds engage the auth gate. Provider guidance from the docs: OAuth (Nous Portal) preferred for anything reachable beyond your own machine (VPS, public host, cloud); username/password only for trusted LAN or VPN (Tailscale — bind to the tailscale IP); never expose a password-protected backend to the open internet. The messaging gateway is a separate long-running process from `hermes serve` — keep both alive on a remote host.

## Known rough edges

- Electron download (~114MB) on install/build can hang on throttling networks; recent versions self-heal via a mirror fallback.
- macOS TCC permission prompts and Gatekeeper on first run are expected — the backend runs real agent commands; a signing-identity setup reduces the friction.
- If a remote host's SSH key changes, Desktop hard-fails ("latches") rather than silently retrying.
- It is the heaviest way to run Hermes; the lightest server install is Docker, not Desktop.

## Recent changes (v2026.8.27 line)

Consent-gated browsing with your real Chrome profile (Windows close-with-approval flow), the built-in browser in its own OS window, opt-in OS-keychain encryption for secrets (no more per-launch macOS Keychain prompts), fleet profile rail, managed SSH remote-update engine. Prior release: Bot Mode group-room threads and desktop rendering performance work.

## Desktop vs CLI/TUI

Same agent, shared state — start in one, resume in the other. Desktop is best at multi-session work, the Bot Mode roster, remote-gateway management, and visual context controls. The CLI/TUI is best at worktree-parallel agents (`hermes -w`), background sessions, shell passthrough, and scripting; the TUI is officially "the recommended way to run Hermes interactively." Choose Desktop if you're new or juggle several agents/machines; choose the terminal if you script your tools.

## FAQ

**Is Hermes Desktop different from the CLI?** No — same agent, native UI ("not a separate product or a lightweight clone"). Sessions move freely between app and terminal.

**Install on Ubuntu?** Download the Linux build, or run `hermes desktop` if the CLI is installed.

**Plugins?** Yes — same skills/plugins/MCP servers as every surface; browse curated skills and community plugins on the Atlas.

**Connect to a VPS or Hermes Cloud?** Yes, several at once. OAuth for public reachability; username/password only over LAN/VPN.

**Why the macOS permission prompts?** The backend executes real commands; TCC/Gatekeeper gating is expected on first run.
