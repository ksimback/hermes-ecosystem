# How to Install Hermes Agent on Windows 10/11: PowerShell, Desktop Installer, or WSL2

The Windows install guide. Live version: https://hermesatlas.com/guide/install/windows/ — facts sourced from the official docs. Current release is v0.21.0 (as of 2026-08-31).

## TL;DR

Native Windows is **Tier 1** — Hermes runs on Windows 10 and 11 (x86_64 and aarch64) with no WSL, no Cygwin, no Docker. Three install paths:

1. **PowerShell one-liner** (fastest if you're in a terminal): `iex (irm https://hermes-agent.nousresearch.com/install.ps1)` — no admin rights required.
2. **Hermes Desktop installer** (recommended by Nous for most people): download the `.exe` from the official site; on first launch it runs `install.ps1` under the hood, and the GUI and CLI share the same install.
3. **WSL2** — only if you specifically want a POSIX environment (see below for the official when-to-pick guidance).

This guide covers Hermes Agent **v0.21.0**.

## What the PowerShell installer does

- Installs everything to `%LOCALAPPDATA%\hermes\` and adds `hermes` to your **User PATH** — open a new terminal after it finishes. No admin rights, no UAC.
- Bootstraps `uv`, Python 3.11, Node.js 26 (winget or a portable tarball), and — if `git` isn't already on PATH — a self-contained PortableGit (~45 MB) under `%LOCALAPPDATA%\hermes\git`.
- Sets `HERMES_GIT_BASH_PATH` so Hermes can run shell commands through Git Bash (the same strategy Claude Code uses on Windows).
- Runs the `hermes setup` wizard at the end (skip with `-SkipSetup`).

Installer parameters (scriptblock form required): `-Branch`, `-Commit`, `-Tag` (pin a version), `-NoVenv`, `-SkipSetup`, `-HermesHome`, `-InstallDir`.

## What works natively

Per the official feature matrix, everything except one feature runs natively on Windows: CLI, interactive TUI (`hermes --tui`), the full messaging gateway (Telegram, Discord, Slack, WhatsApp, 15+ platforms), cron scheduler, browser tool, MCP servers, local Ollama/LM Studio, web dashboard, and auto-start at login (via Scheduled Tasks, no admin). The one exception: the dashboard's `/chat` embedded terminal pane needs a POSIX PTY and is WSL2-only.

## Native or WSL2?

Both are Tier 1. Official guidance: pick **WSL2** if you want the dashboard's embedded terminal, you do POSIX-heavy development and want Hermes on the same Linux filesystem as your tools, or you already maintain WSL2. **Native is fine — or better** — for everyone else: you skip crossing the WSL↔Windows boundary every time you touch a file or URL.

WSL2 path: `wsl --install` in Admin PowerShell, reboot, then run the Linux installer inside Ubuntu: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`. Native data lives under `%LOCALAPPDATA%\hermes`, WSL data under `~/.hermes` — the two coexist cleanly.

## Gateway at Windows login

`hermes gateway install` registers a Scheduled Task (`ONLOGON`, non-elevated — no UAC) with a Startup-folder fallback, and spawns the gateway detached via `pythonw.exe` so a stray Ctrl+C can't kill it. Manage with `hermes gateway status/start/stop/restart/uninstall`.

## Common pitfalls

- **`hermes: command not found` right after install** — open a NEW PowerShell window; existing shells don't see the updated User PATH.
- **`[scriptblock]::Create(...)` fails** — your `install.ps1` download picked up a UTF-8 BOM; use the plain `irm | iex` form instead.
- **`/edit` does nothing** — Hermes defaults `EDITOR=notepad`; to use VS Code set `$env:EDITOR = "code --wait"` (the `--wait` is critical).
- **Non-Latin characters show as `?`** — the UTF-8 stdio shim didn't activate; check `HERMES_DISABLE_WINDOWS_UTF8` is unset, or switch to Windows Terminal.
- **Weird Node version errors** — an older system Node is earlier on PATH than Hermes's bundled Node 26.

## Uninstall

`hermes uninstall` removes the scheduled task, launchers, and the `hermes-agent\` checkout but keeps your config/sessions/skills in `%LOCALAPPDATA%\hermes`. To remove everything: also `Remove-Item -Recurse -Force "$env:LOCALAPPDATA\hermes"`.

## FAQ

**Do I need admin rights to install Hermes on Windows?** No. The PowerShell installer writes only to `%LOCALAPPDATA%\hermes` and your User PATH; gateway auto-start uses a non-elevated Scheduled Task.

**Is native Windows still "early beta"?** No — Windows 10/11 native is a Tier 1 platform in the official support matrix, alongside macOS and Linux. Only the dashboard's embedded terminal pane is WSL2-only.

**Should I install natively or in WSL2?** Native for most people. WSL2 if you want the dashboard's embedded terminal or a real POSIX dev environment shared with your tools.

**Where does Hermes install on Windows?** Code at `%LOCALAPPDATA%\hermes\hermes-agent\`, your data (config, keys, sessions, skills) directly under `%LOCALAPPDATA%\hermes\`. Reinstalls replace only the checkout; your data survives.

**Does the messaging gateway (Telegram/Discord) work on native Windows?** Yes — the full gateway is in the native feature matrix, and `hermes gateway install` keeps it running at login via Scheduled Tasks.

**Windows on ARM?** Yes — the official matrix lists Windows 10/11 on both x86_64 and aarch64 as Tier 1.
