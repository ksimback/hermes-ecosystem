# Mcporter

**Source:** https://hermes-agent.nousresearch.com/docs/ko/user-guide/skills/optional/mcp/mcp-mcporter

Use the mcporter CLI to list, configure, auth, and call MCP servers/tools directly (HTTP or stdio), including ad-hoc servers, config edits, and CLI/type generation.

## Skill metadata

Source

Optional — install with `hermes skills install official/mcp/mcporter`

Path

`optional-skills/mcp/mcporter`

Version

`1.0.0`

Author

community

License

MIT

Platforms

linux, macos, windows

Tags

`MCP`, `Tools`, `API`, `Integrations`, `Interop`

## Reference: full SKILL.md

정보

The following is the complete skill definition that Hermes loads when this skill is triggered. This is what the agent sees as instructions when the skill is active.

# mcporter

Use `mcporter` to discover, call, and manage [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers and tools directly from the terminal.

## Prerequisites

Requires Node.js:

```
# No install needed (runs via npx)
npx mcporter list

# Or install globally
npm install -g mcporter
```

## Quick Start

```
# List MCP servers already configured on this machine
mcporter list

# List tools for a specific server with schema details
mcporter list <server> --schema

# Call a tool
mcporter call <server.tool> key=value
```

## Discovering MCP Servers

mcporter auto-discovers servers configured by other MCP clients (Claude Desktop, Cursor, etc.) on the machine. To find new servers to use, browse registries like [mcpfinder.dev](https://mcpfinder.dev) or [mcp.so](https://mcp.so), then connect ad-hoc:

```
# Connect to any MCP server by URL (no config needed)
mcporter list --http-url https://some-mcp-server.com --name my_server

# Or run a stdio server on the fly
mcporter list --stdio "npx -y @modelcontextprotocol/server-filesystem" --name fs
```

## Calling Tools

```
# Key=value syntax
mcporter call linear.list_issues team=ENG limit:5

# Function syntax
mcporter call "linear.create_issue(title: \"Bug fix needed\")"

# Ad-hoc HTTP server (no config needed)
mcporter call https://api.example.com/mcp.fetch url=https://example.com

# Ad-hoc stdio server
mcporter call --stdio "bun run ./server.ts" scrape url=https://example.com

# JSON payload
mcporter call <server.tool> --args '{"limit": 5}'

# Machine-readable output (recommended for Hermes)
mcporter call <server.tool> key=value --output json
```

## Auth and Config

```
# OAuth login for a server
mcporter auth <server | url> [--reset]

# Manage config
mcporter config list
mcporter config get <key>
mcporter config add <server>
mcporter config remove <server>
mcporter config import <path>
```

Config file location: `./config/mcporter.json` (override with `--config`).

## Daemon

For persistent server connections:

```
mcporter daemon start
mcporter daemon status
mcporter daemon stop
mcporter daemon restart
```

## Code Generation

```
# Generate a CLI wrapper for an MCP server
mcporter generate-cli --server <name>
mcporter generate-cli --command <url>

# Inspect a generated CLI
mcporter inspect-cli <path> [--json]

# Generate TypeScript types/client
mcporter emit-ts <server> --mode client
mcporter emit-ts <server> --mode types
```

## Notes

-   Use `--output json` for structured output that's easier to parse
-   Ad-hoc servers (HTTP URL or `--stdio` command) work without any config — useful for one-off calls
-   OAuth auth may require interactive browser flow — use `terminal(command="mcporter auth <server>", pty=true)` if needed
