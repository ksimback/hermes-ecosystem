# Hermes Desktop Plugin Atlas methodology

Cutoff: 2026-08-14 13:29:59 EDT / 17:29:59 UTC

Snapshot: 122 public repositories, comprising 96 standalone repositories, 1 official standalone, 20 collections, 3 embedded integrations, and 2 public dotfile plugins. The verifier records 164 direct source proofs and 2 fetched auxiliary paths that are explicitly excluded from entrypoint evidence.

## Evidence boundary

This inventory includes public repositories whose application-side source imports `@hermes/plugin-sdk` and implements a concrete registration or contribution contract. That boundary identifies code intended to run in Hermes Desktop. Documentation mentions, copied templates, backend-only plugins, fixtures, application forks that merely bundle examples, private or deleted repositories, and search results without a verified source file are excluded.

Source verification is an evidence tier, not an endorsement, quality rating, or dynamic safety test. Atlas does not execute plugin code, installers, package scripts, or backends during review. `data/repos.json` remains the quality-filtered Atlas project catalog. A Desktop plugin may be present only as an evidence candidate.

Distribution labels describe packaging:

- `standalone`: a repository primarily distributing one Desktop plugin.
- `collection`: multiple Desktop plugins or independently useful plugin surfaces in one repository.
- `embedded integration`: Desktop code shipped inside a broader product or integration.
- `public dotfile plugin`: plugin source published within personal configuration files.
- `official standalone`: a standalone repository maintained by Nous Research.

## Reproducible source-only method

Discovery is deliberately broader than inclusion. Candidate searches use exact SDK imports, canonical plugin paths, contribution-area names, GitHub topics, and repository descriptions. Search hits are candidates only. They are never promoted automatically into endorsed Atlas projects.

For each existing candidate, `scripts/refresh-desktop-plugins.js` uses authenticated, read-only GitHub API requests to resolve the default branch and its commit, then downloads only the listed source paths as text. A lexical scan ignores comments and string bodies before it accepts a manifest contract. At least one source per repository must contain a real `@hermes/plugin-sdk` import and a concrete registration or contribution signal. Fetched auxiliary paths without a direct signal are retained separately as ignored evidence candidates, never counted as plugin entrypoints. Reviewed URLs use the full commit SHA, never a moving branch, tag, or `HEAD`. The catalog is sorted and serialized deterministically. `--check` compares current heads without writing; `--validate` performs offline invariant checks.

In `cutoff-baseline` mode, every reviewed commit must be no later than 2026-08-14 17:29:59 UTC. A later approved refresh changes the catalog to `current-head` mode and preserves the prior baseline in Git history. Metadata such as stars, forks, and activity is an observation at review time, not a quality score.

## Authority-surface review

Static review records observed risk and authority surface. Reviewers consider:

- renderer-only UI contributions versus process, filesystem, shell, or network access;
- read-only session, context, and usage access versus mutation or command execution;
- credential handling, outbound destinations, embedded remote content, and telemetry;
- backend or installer requirements and persistence mechanisms;
- breadth of contribution areas, profile scope, and whether permissions match the stated purpose;
- minified, generated, vendored, or obfuscated material that lowers static-review confidence.

These dimensions support least-privilege selection. Start with the narrowest plugin that fits the use case, inspect every immutable source path, omit optional installers and backends, and reassess when the reviewed commit changes. Profile separation is useful organization but is not a security sandbox.

## Focused use-case guide

Choose the narrowest authority surface that answers the actual question. The table below records focused static-review findings at the cutoff. It does not turn any repository into a categorical safety claim.

| Need | First choice | Why it fits | Authority cost and guardrail |
|---|---|---|---|
| Context occupancy and when to compress | [Hermes built-in Context Meter](https://github.com/NousResearch/hermes-agent/blob/486f4ace20ba75401681c0915ab79a0968fa6bb1/apps/desktop/src/app/shell/context-usage-panel.tsx) | Uses built-in `session.context_breakdown`; adds no third-party plugin authority | Lowest incremental risk. Enable it from the Desktop status-bar menu before adding a plugin |
| Live tokens per second | [`3684142/hermes-token-meter`](https://github.com/3684142/hermes-token-meter/tree/07c5cdb72c163cc57c907cc2f1c23011e0f912dc), renderer only | Active-session filtering, cleanup, stream estimates corrected by authoritative usage | Low observed renderer authority at the reviewed commit. Use only the pinned `plugin.js`; renderer SHA-256 `3ff54659269c55c863b276bc316e80ea1d1332b2944e163d254e42ab6beff3e1`. The installer and backend are unnecessary. No confirmed public copied derivative was found by the cutoff |
| Minimal approximate throughput | [`asimons81/hermes-desktop-kit`](https://github.com/asimons81/hermes-desktop-kit), Token Speed | Renderer-only timer and wildcard delta listener | Low security authority, but medium correctness risk: no active-session filter and no listener disposal observed |
| Richer context diagnostics | [`James-Win/hermes-context-telemetry`](https://github.com/James-Win/hermes-context-telemetry) | Read-only context breakdown, stale-state indicators, copy-on-click summary | Low observed runtime authority, but it mostly duplicates Context Meter and no license grant was observed |
| Historical tokens and hypothetical list-price cost | [`muntasirrmahdi/hermes-token-cost`](https://github.com/muntasirrmahdi/hermes-token-cost) | Focused read-only `state.db` backend and pricing overview | Low-medium observed authority. Values are list-price estimates, not provider invoices or subscription spend |
| Persistent cache and usage history | Do not choose [`YannZhou/token-cache-monitor`](https://github.com/YannZhou/token-cache-monitor) as shipped | It offers retained cache analytics | High compatibility, retention, and operations cost: patches Hermes gateway source, writes `stats.db`, retains deleted-session snapshots, and runs a watchdog |
| OpenRouter and OpenCode quotas | [`XpycT/hermes-quota`](https://github.com/XpycT/hermes-quota) only when those providers matter | Calls the relevant provider endpoints | Medium-high credential authority: settings can retain overrides and OpenCode authentication cookies |
| Broad account-plan capacity | [`kfa-ai/hermes-llm-usage`](https://github.com/kfa-ai/hermes-llm-usage) | Covers Claude, Grok, Codex, Nous, and Venice windows | Medium-high authority: launches local tools, reads provider credentials, calls remote account APIs, and writes a cache |
| Cross-agent usage history | Avoid [`TurkeyGuoba/ai-usage-monitor`](https://github.com/TurkeyGuoba/ai-usage-monitor) as shipped | Aggregates Hermes, Claude Code, and Codex histories | Medium-high privacy and operations surface: persistent loopback service, broad local history reads, permissive CORS, writable config endpoint, optional watchdog |
| Cross-agent what-if pricing | [`ares0027/hermes-tokscale-pane`](https://github.com/ares0027/hermes-tokscale-pane) only if Tokscale is already trusted | Uses Tokscale for aggregation and simulations | Medium authority: repeatedly executes a global third-party CLI and inherits its environment and pricing sources |
| Full session forensics | [`tommulkins/hermes-plugin-session-analyzer`](https://github.com/tommulkins/hermes-plugin-session-analyzer) | Searches messages, tool arguments, failures, and file paths | Medium privacy surface. Useful for forensics, not a meter replacement |

Workflow controls, memory editors, browsers, and fleet managers generally need broader authority than meters. Require a correspondingly stronger fit and review.

Token and cost values displayed by Context Meter or plugins are estimates derived from available events and pricing assumptions. They are not provider billing and may differ from invoices.

## Limitations

Static source review cannot prove categorical safety, runtime behavior, dependency integrity, future revisions, hosted-service behavior, or absence of undiscovered candidates. Generated or dynamically loaded code may reduce confidence. Repository ownership and contents can change after review. Stars and activity are volatile. Fit is user-specific, and low observed authority does not mean no risk.

## Update workflow

1. Pull the Atlas repository and inspect catalog and methodology changes.
2. Run `node scripts/refresh-desktop-plugins.js --validate` to verify the committed cutoff baseline offline.
3. Run `GITHUB_TOKEN="$(gh auth token)" node scripts/refresh-desktop-plugins.js --check` for a no-write comparison with current default-branch revisions. Run without `--check` only after reviewing the revisions to advance.
4. Review immutable source diffs and authority-surface changes. Do not execute downloaded content.
5. Run `node scripts/refresh-desktop-plugins.js --validate`, `npm test`, and the page build.
6. Prepare a focused pull request. Candidate discovery and inclusion review remain separate, and unattended mutation is not scheduled.
