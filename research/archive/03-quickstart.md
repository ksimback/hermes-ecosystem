# Hermes Agent — Quickstart Guide

**Source:** https://hermes-agent.nousresearch.com/docs/getting-started/quickstart

## Provider Setup

```bash
hermes model       # Choose LLM provider and model
hermes tools       # Configure enabled tools
hermes setup       # Configure everything at once
```

### Available Providers (18+)

Nous Portal (OAuth), OpenAI Codex (OAuth), Anthropic (API key/OAuth), OpenRouter (API key), Z.AI, Kimi/Moonshot, MiniMax, Alibaba Cloud, Hugging Face, Kilo Code, OpenCode Zen/Go, DeepSeek, GitHub Copilot (OAuth), Vercel AI Gateway, Custom Endpoint (vLLM, SGLang, Ollama)

## Starting

```bash
hermes                    # Start chatting
hermes --continue         # Resume last session
hermes -c                 # Short form
```

## Key Slash Commands

| Command | Function |
|---------|----------|
| /help | Show all commands |
| /tools | List available tools |
| /model | Switch models |
| /personality pirate | Try a personality |
| /save | Save conversation |
| /voice on | Enable voice mode |

## Advanced Setup

- **Sandboxed Terminal:** `hermes config set terminal.backend docker`
- **Messaging Gateway:** `hermes gateway setup`
- **Voice Mode:** `pip install "hermes-agent[voice]"`
- **Skills:** `hermes skills search kubernetes`
- **ACP Editor Integration:** `pip install -e '.[acp]' && hermes acp`
- **MCP Servers:** Add to `~/.hermes/config.yaml` under `mcp_servers:`
