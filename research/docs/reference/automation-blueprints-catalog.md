# Automation Blueprints

**Source:** https://hermes-agent.nousresearch.com/docs/reference/automation-blueprints-catalog

Automation Blueprints are ready-to-run automations. Pick one, fill in a couple of fields, and Hermes schedules it as a cron job — no cron syntax required.

Every blueprint works from **every surface**:

-   **Dashboard / desktop app** — open the Cron page, switch to the **Blueprints** tab, fill the form, and click _Schedule it_.
-   **CLI, TUI, and messengers** — type `/blueprint <name>` (e.g. `/blueprint morning-brief`) and Hermes asks you for what it needs, one question at a time, then schedules it. The name match is forgiving — a prefix or near-spelling resolves. Power users can skip the questions by passing values inline: `/blueprint morning-brief time=08:00`.
-   **Desktop app** — click **Send to App** on any blueprint and it opens with the command pre-loaded in your composer.

Blueprints never schedule anything silently — you always confirm before the job is created. Manage created jobs anytime with `/cron`.

Loading blueprints…

## Writing your own

A blueprint is just a skill with a `metadata.hermes.blueprint` block in its `SKILL.md` frontmatter. See [Creating Skills → Automation Blueprints](/docs/developer-guide/creating-skills) for the slot schema and how to publish one.
