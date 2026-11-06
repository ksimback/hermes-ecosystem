# Repository navigation and optional entity edits in Hermes

**Sources:** [Hermes MCP documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp), [Sem](https://github.com/Ataraxy-Labs/sem), and [Weave](https://github.com/Ataraxy-Labs/weave).

Hermes can inspect a local Git checkout through Sem's stdio MCP server.
Install Sem on the machine running Hermes, then merge this entry into the
`mcp_servers` mapping in the active profile's `config.yaml`. Replace both paths;
keep existing servers. This recipe was checked with Sem 0.29.0.

```yaml
mcp_servers:
  sem:
    command: "/absolute/path/to/sem"
    args: ["mcp"]
    env:
      SEM_REPO: "/absolute/path/to/checkout"
      SEM_LOCAL: "1"
      SEM_MCP_NO_SHARED: "1"
      SEM_NO_NETWORK: "1"
      SEM_NO_TELEMETRY: "1"
    tools:
      include: ["sem_find", "sem_grep", "sem_graph", "sem_impact"]
```

Start `hermes chat` or run `/reload-mcp`. Ask: "Use Sem's sem_find to locate
parse_config and show its source location." Substitute a function that exists
in the checkout. Use `hermes mcp configure sem` to inspect the selected tools.
This adds optional MCP tools without replacing Hermes's native tools.

The allowlist limits model-visible tools to inspection. Sem can still create
local indexes. `SEM_LOCAL` disables its MCP cloud client; `SEM_MCP_NO_SHARED`
avoids inheriting a daemon's settings. These flags are not an OS sandbox or a
network firewall. Repository results enter the model's context, so select a
checkout that the configured provider is allowed to process.

## Optional editing

Install Weave and add a separate sibling entry only when entity edits are
wanted (checked with Weave 0.7.0):

```yaml
mcp_servers:
  weave:
    command: "/absolute/path/to/weave-mcp"
    args: []
    env:
      WEAVE_REPO: "/absolute/path/to/checkout"
    tools:
      include: ["weave_edit", "weave_preview"]
```

Combine the two entries under one mapping, not two `mcp_servers` keys.
`weave_edit` writes source files and can run an attached validation command.
Use a disposable branch, retain normal permission controls, inspect the Git
diff, and run project tests. Structural validation does not prove behavior.

If lookup tools are absent, check the executable path, repository access and
server logs. Static call relationships can be incomplete. Remove only the
`sem` or `weave` entry and reload MCP to disconnect it; other servers remain.
