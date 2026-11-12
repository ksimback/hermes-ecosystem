# Hermes Agent — Context Files

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files

## Supported Files

| File | Purpose | Discovery |
|------|---------|-----------|
| .hermes.md / HERMES.md | Project instructions (highest priority) | Walks to git root |
| AGENTS.md | Project conventions, architecture | CWD + progressive subdirectory discovery |
| CLAUDE.md | Claude Code compatibility | CWD + progressive |
| SOUL.md | Global personality | HERMES_HOME only |
| .cursorrules | Cursor IDE conventions | CWD only |

## Priority

First match wins: .hermes.md → AGENTS.md → CLAUDE.md → .cursorrules. SOUL.md always loaded independently.

## Progressive Discovery

Subdirectory AGENTS.md files discovered lazily as agent navigates via tool calls. No system prompt bloat.

## Security

All context files scanned for prompt injection. Blocked patterns include hidden HTML, credential exfiltration, invisible Unicode. Max 20,000 chars per file (70% head, 20% tail truncation).
