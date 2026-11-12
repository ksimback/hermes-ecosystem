# Hermes Agent — Tips & Best Practices

**Source:** https://hermes-agent.nousresearch.com/docs/guides/tips

## Best Results

- Be specific (include file paths, line numbers, error messages)
- Front-load context in one comprehensive message
- Use AGENTS.md for recurring project instructions
- Let agent use its tools autonomously
- Use skills for complex workflows

## CLI Power User

- Alt+Enter for multi-line input
- Paste detection for code blocks
- Ctrl+C to interrupt and redirect
- `hermes -c` to resume sessions
- Ctrl+V for clipboard image paste
- /verbose to cycle tool display modes

## Performance & Cost

- Keep system prompt stable for cache hits
- Use /compress before hitting limits
- delegate_task for parallel work
- execute_code for batch operations
- /usage and /insights for monitoring

## Security

- Docker backend for untrusted code
- "Session" approval before "Always"
- Allowlists for messaging bots (never GATEWAY_ALLOW_ALL_USERS=true with terminal)
