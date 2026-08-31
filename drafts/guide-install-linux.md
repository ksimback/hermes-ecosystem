# How to Install Hermes Agent on Linux (Ubuntu, Debian, Fedora, Arch)

The Linux install guide. Live version: https://hermesatlas.com/guide/install/linux/ — facts sourced from the official docs. Current release is v0.21.0 (as of 2026-08-31).

## TL;DR

One command on any supported distro:

```
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes
```

Linux (x86_64 and aarch64) is **Tier 1**. Nous tests on the latest Ubuntu and WSL2; per the official matrix, "if your distro has glibc, systemd, and follows the Filesystem Hierarchy Standard, it's likely to work pretty well."

This guide covers Hermes Agent **v0.21.0**.

## Prerequisites

- **Git**, plus **curl** and **xz-utils** (the installer downloads Node.js as a `.tar.xz`): `sudo apt install git curl xz-utils` on Debian/Ubuntu.
- For the desktop app only: `build-essential` (g++) to compile native modules.
- The installer handles the rest with no sudo: `uv`, Python 3.11, Node.js 26, ripgrep, ffmpeg.

## Install layout: per-user vs system-wide

- **Per-user (default):** code at `~/.hermes/hermes-agent/`, launcher symlinked to `~/.local/bin/hermes`, data at `~/.hermes/`.
- **Root mode** (`curl … | sudo bash`): FHS layout — code at `/usr/local/lib/hermes-agent/`, binary at `/usr/local/bin/hermes`. Useful for shared machines; per-user config still lives in each user's `~/.hermes/`.

## Ubuntu Server / headless / service-user installs

Running Hermes as a dedicated unprivileged user (e.g. a `hermes` systemd service account) is officially supported. The only step that genuinely needs root is Playwright's Chromium system libraries:

1. Once, as an admin: `sudo npx playwright install-deps chromium`.
2. As the service user, run the normal installer — it detects missing sudo and degrades gracefully. Headless and don't need browser automation? Add `--skip-browser` (and `--skip-computer-use`).
3. Make sure `~/.local/bin` is on the service user's PATH.
4. Verify with `hermes doctor`.
5. Running the messaging gateway from this account? `sudo loginctl enable-linger <service-user>` so the user-level service survives logout and starts at boot.

The same pattern works on Arch, Fedora/RHEL, and openSUSE — those distros don't support Playwright's `--with-deps`, so the installer prints the exact `dnf`/`zypper` commands an admin should run.

## Distro notes

- **Ubuntu / Debian** — the tested reference platform. Fresh minimal cloud image: `apt-get install -y git curl xz-utils` first.
- **Fedora / RHEL / openSUSE** — supported via the same installer; admin installs Chromium system libraries separately (commands printed by the installer).
- **Arch** — the installer works (same sudo-detection logic, via pacman). **The AUR package is explicitly unsupported** — use the official installer.
- **Nix / NixOS** — no longer an explicitly supported install path (Tier 2, best-effort): the official matrix says it "breaks often due to node.js packaging woes." There's a dedicated Nix setup guide with a flake and NixOS module if you accept that tradeoff.

## Updating

`hermes update` auto-detects the git-installer layout and updates in place. (Docker installs update by pulling a new image instead.)

## FAQ

**How do I install Hermes Agent on Ubuntu?** `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`, then `source ~/.bashrc`. Ubuntu is the distro Nous tests against.

**Does the installer need sudo?** No for the core install — it's per-user under `~/.hermes/`. Root is only needed once for Playwright's Chromium system libraries (or skip browser tools with `--skip-browser`).

**Which distros are supported?** Latest Ubuntu and WSL2 are tested; anything with glibc, systemd, and FHS is expected to work. Alpine (musl) doesn't fit that description.

**Can I install from the AUR on Arch?** No — AUR installs are explicitly unsupported. Run the official installer on Arch instead.

**How do I keep the gateway running on a server?** Install as a service user, run `hermes gateway setup` (it offers a systemd user unit), and enable lingering: `sudo loginctl enable-linger <user>`.

**What about NixOS?** Tier 2 / best-effort — there's an extensive official Nix guide, but releases may break it. Docker or an FHS distro is the supported path.
