# Impeccable

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/skills/optional/creative/creative-impeccable

Frontend design guidance, upstream-maintained (impeccable).

## Skill metadata

Source

Optional — install with `hermes skills install official/creative/impeccable`

Path

`optional-skills/creative/impeccable`

Version

`4.1.2`

Author

Paul Bakaus (pbakaus)

License

Apache-2.0

Platforms

linux, macos, windows

Tags

`design`, `frontend`, `ui`, `ux`, `web-design`, `anti-slop`

Related skills

[`claude-design`](/docs/user-guide/skills/bundled/creative/creative-claude-design), [`popular-web-designs`](/docs/user-guide/skills/bundled/creative/creative-popular-web-designs)

## Reference: full SKILL.md

info

The following is the complete skill definition that Hermes loads when this skill is triggered. This is what the agent sees as instructions when the skill is active.

# Impeccable (upstream-maintained)

> **Catalog stub.** This entry is maintained upstream at [pbakaus/impeccable](https://github.com/pbakaus/impeccable): the project ships and verifies a Hermes-native skill bundle under `.hermes/skills/`. `hermes skills install impeccable` pulls the current bundle live from that repo (quarantined and scanned like any hub install) — this directory holds only the catalog metadata, so the vendored copy can never go stale.

Impeccable is a design language for AI coding agents: one skill exposing 23 sub-commands (`/impeccable init`, `craft`, `shape`, `critique`, `audit`, `polish`, `bolder`, `quieter`, `distill`, `harden`, `onboard`, `animate`, `colorize`, `typeset`, `layout`, `delight`, `overdrive`, `clarify`, `adapt`, `optimize`, `extract`, `document`, `live`), explicit anti-pattern guidance (overused fonts, purple gradients, nested cards, bounce easing), and a 61-rule deterministic detector CLI (`npx impeccable detect`) that needs no LLM or API key.

After install, start with:

```
/impeccable init
```

Full documentation: [https://impeccable.style](https://impeccable.style)
