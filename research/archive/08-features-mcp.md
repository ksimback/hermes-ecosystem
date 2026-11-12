# Hermes Agent — MCP (Model Context Protocol)

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp

## Overview

MCP connects Hermes to external tool servers — GitHub, databases, file systems, browser stacks, internal APIs.

## Server Types

- **Stdio** — Local subprocesses via stdin/stdout
- **HTTP** — Remote endpoints

## Tool Registration

Tools namespaced as `mcp_<server>_<tool>` to prevent collisions.

## Per-Server Filtering

Whitelist (`include`), blacklist (`exclude`), disable utilities (`prompts: false`, `resources: false`), or disable entirely (`enabled: false`).

## MCP Sampling

Servers can request LLM inference from Hermes via `sampling/createMessage`. Configurable model, rate limits, token caps.

## Hermes as MCP Server

`hermes mcp serve` — Exposes messaging capabilities to other MCP clients (Claude Code, Cursor). 10 tools: conversations_list, messages_read, messages_send, events_poll, events_wait, etc.
