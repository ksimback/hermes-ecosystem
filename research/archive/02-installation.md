# Hermes Agent — Installation Guide

**Source:** https://hermes-agent.nousresearch.com/docs/getting-started/installation

## Quick Install (Linux / macOS / WSL2)

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc   # or: source ~/.zshrc
hermes             # Start chatting!
```

**Windows:** Native Windows not supported. Use WSL2.

## What the Installer Does

Handles: Python, Node.js, ripgrep, ffmpeg, repo cloning, virtual environment, global command, LLM provider setup.

## Prerequisites

Only **Git** required. Installer manages: uv, Python 3.11, Node.js v22, ripgrep, ffmpeg.

## Post-Install Configuration

```bash
hermes model          # Choose LLM provider
hermes tools          # Enable/disable tools
hermes gateway setup  # Configure messaging platforms
hermes config set     # Set individual values
hermes setup          # Full configuration wizard
```

## Manual Installation

```bash
git clone --recurse-submodules https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv venv --python 3.11
export VIRTUAL_ENV="$(pwd)/venv"
uv pip install -e ".[all]"
npm install
mkdir -p ~/.hermes/{cron,sessions,logs,memories,skills,pairing,hooks,image_cache,audio_cache,whatsapp/session}
cp cli-config.yaml.example ~/.hermes/config.yaml
touch ~/.hermes/.env
```

## Verification

```bash
hermes version
hermes doctor
hermes status
hermes chat -q "Hello! What tools do you have available?"
```
