# Hermes Agent — Personality & SOUL.md

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/personality

## SOUL.md

Primary identity file at `~/.hermes/SOUL.md`. First thing in system prompt. Controls tone, directness, style.

## Built-in Personalities (14)

helpful, concise, technical, creative, teacher, kawaii, catgirl, pirate, shakespeare, surfer, noir, uwu, philosopher, hype

## Custom Personalities

Define in `~/.hermes/config.yaml` under `agent.personalities:`.

## SOUL.md vs AGENTS.md

- SOUL.md = identity, tone (follows you everywhere)
- AGENTS.md = project architecture, conventions (belongs to a project)

## Prompt Stack Order

1. SOUL.md → 2. Tool guidance → 3. Memory/user → 4. Skills → 5. Context files → 6. Timestamp → 7. Platform hints → 8. /personality overlay
