# Official Docs Update Policy for Ask the Atlas

**Source:** Atlas curation note based on official Hermes Agent docs updates from May 26-27, 2026.

Ask the Atlas should mirror official Hermes Agent docs continuously, but official-doc chunks are not all equally valuable for retrieval. Official product-feature docs should be preferred for capability questions; generated catalog/index pages should remain available for lookup queries without overwhelming broad product answers.

## Retrieval policy

- **Official docs:** prefer over community notes when relevance is similar.
- **Curated Atlas summaries:** prefer for broad conceptual answers and conflict resolution.
- **Catalog/generated pages:** use as lookup sources for explicit catalog, skills, registry, and install-source questions; suppress for broad “what is Hermes?” style questions.
- **Repo metadata:** use for rankings, recommendations, star counts, and ecosystem comparisons.

## Skills Hub catalog-source update

The official Skills Hub now aggregates a much broader multi-source catalog instead of the older partial snapshot. Sources include built-in and optional Hermes skills plus external/catalog sources such as skills.sh, ClawHub, browse.sh, OpenAI, HuggingFace, Anthropic, LobeHub, GitHub taps, and Claude Marketplace.

**Ask the Atlas handling:** ingest this as official docs, but treat it as catalog metadata. It should rank highly for skills, Skills Hub, catalog, registry, and install-source queries, but should not crowd out core Hermes overview or feature answers.

## TUI session orchestrator update

Hermes Agent's Ink TUI includes an active-session orchestrator for managing live process-local TUI sessions. It supports listing, activating/switching, closing, and launching sessions; hydrating committed and in-flight output when switching; dispatching a new prompt session from the `+new` row with session-scoped model picks; exposing a clickable live-session count in the status chrome; and mouse-aware floating orchestrator overlays.

**Ask the Atlas handling:** treat this as product-feature knowledge. It should rank highly for TUI, session switching, active sessions, session-scoped model picks, and `+new` session-launch queries.
