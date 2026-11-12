# Hermes Agent — Tools & Toolsets

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/tools

## Tool Categories

| Category | Examples |
|----------|----------|
| Web | web_search, web_extract |
| Terminal & Files | terminal, process, read_file, patch |
| Browser | browser_navigate, browser_snapshot, browser_vision |
| Media | vision_analyze, image_generate, text_to_speech |
| Agent orchestration | todo, clarify, execute_code, delegate_task |
| Memory & recall | memory, session_search |
| Automation & delivery | cronjob, send_message |
| Integrations | ha_*, MCP, rl_* |

## Terminal Backends

| Backend | Use Case |
|---------|----------|
| local | Development, trusted tasks (default) |
| docker | Security, reproducibility |
| ssh | Remote server sandboxing |
| singularity | HPC/cluster computing |
| modal | Serverless cloud scaling |
| daytona | Persistent remote environments |

## Container Security

Read-only root, dropped capabilities, no privilege escalation, PID limits (256), namespace isolation, persistent workspaces via volumes.

## Background Process Management

Terminal supports `background=true` for long-running commands. Manage via `process` tool (list, poll, wait, log, kill, write).
