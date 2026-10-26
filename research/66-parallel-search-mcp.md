# Free web search and page fetching with Parallel Search MCP

**Sources:** https://docs.parallel.ai/integrations/mcp/search-mcp and https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp

Parallel Search MCP gives Hermes Agent an opt-in way to search the web and read specific pages without a Parallel account or API key. Anonymous search uses Fast mode. This hosted service is intended for exploration and light use; free access has rate limits.

## Connect Hermes to the remote server

Install Hermes using the [official installation guide](https://hermes-agent.nousresearch.com/docs/getting-started/installation). MCP support ships with the standard installation, so no local MCP server or Parallel CLI package is needed.

Add the `parallel` entry under `mcp_servers` in your active profile's `config.yaml` (normally `~/.hermes/config.yaml`):

```yaml
mcp_servers:
  parallel:
    url: "https://search.parallel.ai/mcp"
    headers:
      User-Agent: "Hermes-Agent"
    tools:
      include: ["web_search", "web_fetch"]
```

Merge this entry into the existing `mcp_servers` mapping rather than creating a second mapping or replacing other servers. If `parallel` is already in use, choose another server name. The server uses Streamable HTTP. Do not add an Authorization header for anonymous access.

Start a new session with `hermes chat`, or use `/reload-mcp` in an existing session. Hermes discovers the two tools and exposes them under the server's namespace. This adds MCP tools; it does not change the selected native `web_search` or `web_extract` provider.

## Search, then fetch a source

Ask explicitly for the configured server so Hermes can distinguish it from the native web tools:

```text
Use the Parallel MCP server to find the official Hermes Agent MCP setup
instructions. Fetch the documentation page you find and summarize how to
connect a remote HTTP MCP server. Cite the source URL.
```

The underlying MCP tools are:

- `web_search`: provide an `objective` and at least one `search_queries` entry. The result contains source URLs and excerpts.
- `web_fetch`: provide `urls` to read specific HTTP or HTTPS pages, with an optional short `objective` to focus the excerpts. Fetch accepts up to 20 URLs per call.

Search and fetch return excerpts by default, with roughly 25,000 characters of total excerpts per call. Prefer fetching a relevant source over asking for every page's full content.

## Troubleshooting and removal

If the tools do not appear, confirm you edited the active profile's configuration, check that the Hermes process can reach `https://search.parallel.ai/mcp`, and reload MCP or start a new session. Use `hermes mcp configure parallel` to inspect the discovered tools and their selection. For a rate-limit response, wait for the indicated retry time instead of repeatedly retrying.

To disable this connection, add `enabled: false` inside the `parallel` entry and reload MCP. Remove only that entry to uninstall the configuration.

The existing [Parallel CLI skill](https://hermes-agent.nousresearch.com/docs/user-guide/skills/optional/research/research-parallel-cli) is a separate workflow with authentication and additional capabilities such as deep research and enrichment. This guide configures only the anonymous Search MCP tools; keep using Hermes's native web tools for ordinary lookups unless you specifically want Parallel.
