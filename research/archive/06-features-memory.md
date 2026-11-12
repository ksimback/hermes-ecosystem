# Hermes Agent — Persistent Memory

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/memory

## Core Structure

| File | Purpose | Char Limit |
|------|---------|-----------|
| MEMORY.md | Agent's personal notes | 2,200 chars (~800 tokens) |
| USER.md | User profile | 1,375 chars (~500 tokens) |

Storage: `~/.hermes/memories/`

## Memory Tool Actions

- **add** — Create new entry
- **replace** — Update via substring matching
- **remove** — Delete via substring matching

Memory loads as frozen snapshot in system prompt at session start.

## External Memory Providers (8)

Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover, Supermemory

## Session Search

SQLite FTS5 full-text search across `~/.hermes/state.db` for historical recall beyond bounded memory.
