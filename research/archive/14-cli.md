# Hermes Agent — CLI Interface

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/cli

## Features

Multiline editing, slash-command autocomplete, conversation history, interrupt-and-redirect, streaming tool output.

## Key Bindings

Enter (send), Alt+Enter/Ctrl+J (newline), Ctrl+B (voice record), Ctrl+C (interrupt), Ctrl+D (exit), Ctrl+Z (suspend), Tab (autocomplete)

## Status Bar

Model, token count, context bar (color-coded), cost estimate, session duration.

## Session Management

```bash
hermes --continue    # Resume most recent
hermes -c "name"     # Resume by title
hermes -r <id>       # Resume by ID
```

## Background Sessions

`/background <prompt>` — Spawns isolated agent session in daemon thread. Non-blocking, multiple concurrent.

## Quick Commands

Custom shell commands in config.yaml under `quick_commands:` — execute without LLM invocation.
