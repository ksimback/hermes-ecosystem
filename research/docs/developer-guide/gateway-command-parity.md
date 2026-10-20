# Gateway command parity (local sessions)

**Source:** https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-command-parity

Every local client (classic CLI, Ink TUI, Desktop, ACP) attaches to the one gateway that owns the session. A slash command either runs in the client against a canonical verb (`session.mutate`, `session.create`, `prompt.receipt`, ...), or goes to the owner as `slash.exec`, where `gateway/session_commands.py` runs only the reviewed reads below and refuses the rest (`unsupported_command`). The classic CLI (`hermes chat`) is main's `HermesCLI` with a gateway-backed agent and session store: its column names the main handler it runs in-process (turns, tools and session writes go to the gateway through `hermes_cli/gateway_agent.py` / `gateway_session_store.py`). The `--stream-json` / safe-mode transport client keeps its own narrower routes (`hermes_cli/gateway_chat_commands.py`).

**Gateway (`slash.exec`)**: `read` = the real handler runs for a local session (proved by `tests/gateway/test_session_read_commands.py`); `control` = admission-fenced write (`/approve` `/deny` resolve this session's waiting approval, `tests/gateway/test_session_approval_commands.py`); `refused`. **Notes**: `per-session setting (gateway handler)` = the messaging handler runs and applies the setting to this local session (its next turn and `config.get`), saving config.yaml only where the handler does; `client-local (cli_only)` commands are terminal/UI features of a client.

104 registry commands: 29 control, 18 read, 57 refused.

Command

Gateway (`slash.exec`)

Classic CLI

Ink

Desktop

ACP

Notes

`/agents` (/tasks)

refused

HermesCLI.\_handle\_agents\_command

delegation.pause

action: agents

slash.exec: refused

gateway-wide: lists every chat's running agents and the process's async jobs

`/approvals`

control

HermesCLI.\_handle\_approvals\_command

slash.exec

slash.exec

slash.exec

per-session setting (gateway handler)

`/approve`

control

messaging-only: unknown command

slash.exec

slash.exec

slash.exec

messaging-only

`/autoprune`

control

HermesCLI.\_handle\_autoprune\_command

slash.exec

slash.exec

slash.exec

`/battery`

refused

HermesCLI.\_handle\_battery\_command

sidecar: system.battery (preference not saved)

slash.exec: refused

slash.exec: refused

client-local (cli\_only)

`/bg`

refused

HermesCLI.\_handle\_background\_command

prompt.background

action: background

slash.exec: refused

`/blueprint` (/bp)

control

HermesCLI.\_handle\_blueprint\_command

slash.exec

slash.exec

slash.exec

`/branch` (/fork)

refused

HermesCLI.\_handle\_branch\_command

canonical route

action: branch

ACP fork\_session

`/browser`

refused

HermesCLI.\_handle\_browser\_command

sidecar: browser.manage

action: browser

slash.exec: refused

client-local (cli\_only)

`/btw`

refused

HermesCLI.\_handle\_btw\_command

prompt.btw

action: btw

slash.exec: refused

`/bundles`

read

HermesCLI.\_handle\_bundles\_command

slash.exec

slash.exec

slash.exec

`/busy`

control

HermesCLI.\_handle\_busy\_command

canonical route

unavailable: terminal

slash.exec

per-session setting (gateway handler)

`/clear`

refused

HermesCLI.\_cmd\_clear

local

action: new

session.mutate reset

client-local (cli\_only)

`/codex-runtime` (/codex\_runtime)

control

HermesCLI.\_handle\_codex\_runtime

slash.exec

slash.exec

slash.exec

per-session setting (gateway handler)

`/commands`

read

messaging-only: unknown command

slash.exec

action: help

slash.exec

messaging-only

`/compress` (/compact)

refused

HermesCLI.\_manual\_compress

canonical route

action: compress

session.mutate compress

`/config`

refused

HermesCLI.show\_config

canonical route

action: config

slash.exec: refused

client-local (cli\_only)

`/context` (/ctx)

read

HermesCLI.\_show\_context\_breakdown

slash.exec

slash.exec

slash.exec

TUI session: main's live /context with the category table

`/copy`

refused

HermesCLI.\_handle\_copy\_command

local

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/cron`

refused

HermesCLI.\_handle\_cron\_command

slash.exec

unavailable: terminal

slash.exec: refused

TUI session: bare `/cron` and `/cron list [--all]` read the profile's jobs; client-local (cli\_only)

`/curator`

control

HermesCLI.\_handle\_curator\_command

slash.exec

unavailable: advanced

slash.exec

`/debug`

control

HermesCLI.\_handle\_debug\_command

slash.exec

slash.exec

slash.exec

uploads logs to a public paste

`/deny`

control

messaging-only: unknown command

slash.exec

slash.exec

slash.exec

messaging-only

`/diff`

read

HermesCLI.\_handle\_diff\_command

slash.exec

slash.exec

slash.exec

`/discard`

refused

messaging-only: unknown command

slash.exec: refused

slash.exec: refused

prompt.resolve\_unknown

messaging-only

`/egress`

control

HermesCLI.\_cmd\_egress

slash.exec

slash.exec

slash.exec

`/export`

refused

HermesCLI.\_handle\_export\_command

slash.exec: refused

action: export

slash.exec: refused

client-local (cli\_only)

`/fast`

control

HermesCLI.\_handle\_fast\_command

config.get, config.set

unavailable: advanced

slash.exec

per-session setting (gateway handler)

`/focus`

refused

HermesCLI.\_handle\_focus\_command

local (preference not saved)

slash.exec: refused

slash.exec: refused

client-local (cli\_only)

`/footer`

control

HermesCLI.\_handle\_footer\_command

slash.exec

unavailable: terminal

slash.exec

per-session setting (gateway handler)

`/goal`

control

HermesCLI.\_handle\_goal\_command

slash.exec

slash.exec

slash.exec

`/handoff`

refused

HermesCLI.\_handle\_handoff\_command

slash.exec: refused

action: handoff

slash.exec: refused

client-local (cli\_only)

`/hatch` (/generate-pet)

refused

HermesCLI.\_handle\_hatch\_command

slash.exec: refused

action: hatch

slash.exec: refused

client-local (cli\_only)

`/heartbeat` (/hb)

control

HermesCLI.\_handle\_heartbeat\_command

slash.exec

slash.exec

slash.exec

`/help`

read

HermesCLI.\_cmd\_help

local

action: help

local

`/history`

refused

HermesCLI.show\_history

local

action: history

slash.exec: refused

client-local (cli\_only)

`/image`

refused

HermesCLI.\_handle\_image\_command

local

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/import`

refused

HermesCLI.\_handle\_import\_command

slash.exec: refused

action: import

slash.exec: refused

client-local (cli\_only)

`/indicator`

refused

HermesCLI.\_handle\_indicator\_command

config.get, config.set

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/init`

control

HermesCLI.\_handle\_init\_command

slash.exec

slash.exec

slash.exec

`/insights`

read

HermesCLI.\_show\_insights

slash.exec

unavailable: advanced

slash.exec

`/journey` (/learning, /memory-graph)

refused

HermesCLI.\_handle\_journey\_command

local

action: journey

slash.exec: refused

client-local (cli\_only)

`/kanban`

read (list/show/stats/assignees/context/runs/log/diagnostics)

HermesCLI.\_handle\_kanban\_command

slash.exec

unavailable: advanced

slash.exec

`/learn`

control

HermesCLI.\_handle\_learn\_command

slash.exec

slash.exec

slash.exec

`/login`

control

HermesCLI.\_handle\_login\_command

slash.exec

unavailable: settings

slash.exec

`/loop` (/proactive)

control

HermesCLI.\_handle\_loop\_command

slash.exec

slash.exec

slash.exec

`/memory`

read (bare / `pending`)

HermesCLI.\_handle\_memory\_command

slash.exec

slash.exec

slash.exec

`/moa`

control

HermesCLI.\_cmd\_moa

slash.exec

slash.exec

slash.exec

`/model`

refused

HermesCLI.\_handle\_model\_switch

canonical route

picker: model

session.mutate model

`/new` (/reset)

refused

HermesCLI.\_cmd\_new

local

action: new

session.mutate reset

`/palette`

refused

HermesCLI.\_open\_command\_palette

slash.exec: refused

action: palette

slash.exec: refused

client-local (cli\_only)

`/paste`

refused

HermesCLI.\_handle\_paste\_command

local

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/pause`

refused

messaging-only: unknown command

slash.exec: refused

slash.exec: refused

slash.exec: refused

messaging-only

`/personality`

control

HermesCLI.\_handle\_personality\_command

canonical route

slash.exec

slash.exec

per-session setting (gateway handler)

`/pet`

refused

HermesCLI.\_handle\_pet\_command

slash.exec

action: pet

slash.exec: refused

client-local (cli\_only)

`/plan`

control

HermesCLI.\_handle\_plan\_command

slash.exec

slash.exec

slash.exec

`/platform`

refused

messaging-only: unknown command

slash.exec: refused

slash.exec: refused

slash.exec: refused

messaging adapters; `pause`/`resume` mutate them

`/platforms` (/gateway)

read

HermesCLI.\_show\_gateway\_status

slash.exec

unavailable: terminal

slash.exec

client-local (cli\_only)

`/plugins`

refused

HermesCLI.\_cmd\_plugins

slash.exec

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/profile`

read

HermesCLI.\_handle\_profile\_command

slash.exec

action: profile

slash.exec

`/prompt` (/compose)

refused

HermesCLI.\_handle\_prompt\_compose\_command

local

slash.exec: refused

slash.exec: refused

client-local (cli\_only)

`/queue` (/q)

refused

HermesCLI.\_cmd\_queue

local

action: queue

prompt.submit

`/quit` (/exit)

refused

HermesCLI.\_cmd\_exit

local

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/reasoning`

control

HermesCLI.\_handle\_reasoning\_command

canonical route

action: reasoning

slash.exec

per-session setting (gateway handler)

`/redraw`

refused

HermesCLI.\_cmd\_redraw

local

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/refine`

control

HermesCLI.\_handle\_refine\_command

slash.exec

slash.exec

slash.exec

`/reload`

refused

HermesCLI.\_cmd\_reload

canonical route

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/reload-mcp` (/reload\_mcp)

refused

HermesCLI.\_confirm\_and\_reload\_mcp

canonical route

unavailable: advanced

slash.exec: refused

`/reload-skills` (/reload\_skills)

refused

HermesCLI.\_cmd\_reload\_skills

commands.catalog, skills.reload

unavailable: advanced

slash.exec: refused

`/restart`

refused

messaging-only: unknown command

slash.exec: refused

unavailable: terminal

slash.exec: refused

messaging-only

`/resume`

refused

HermesCLI.\_handle\_resume\_command

local

picker: session

slash.exec: refused

switches the messaging chat's session; local clients resume by id

`/retry`

refused

HermesCLI.\_cmd\_retry

canonical route

action: retry

session.mutate rewind + resubmit

`/review`

control

HermesCLI.\_handle\_review\_command

slash.exec

slash.exec

slash.exec

`/rollback`

refused

HermesCLI.\_handle\_rollback\_command

rollback.diff, rollback.list, rollback.restore

action: rollback

slash.exec: refused

restores filesystem checkpoints

`/save`

refused

HermesCLI.save\_conversation

canonical route

action: save

slash.exec: refused

the gateway handler writes its file on the gateway host; Desktop saves `session.export` text through its own dialog

`/sessions`

refused

HermesCLI.\_handle\_sessions\_command

local

picker: session

slash.exec: refused

messaging origin-scoped listing (`/sessions all` needs a messaging admin)

`/sethome` (/set-home)

refused

messaging-only: unknown command

slash.exec: refused

unavailable: terminal

slash.exec: refused

messaging-only

`/skills`

read (bare/`pending`/`diff`; `approve`/`reject`/`approval` control; hub refused)

HermesCLI.\_cmd\_skills

slash.exec; sidecar: skills.manage

slash.exec

slash.exec

client-local (cli\_only)

`/skin`

refused

HermesCLI.\_handle\_skin\_command

config.get, config.set

action: skin

slash.exec: refused

client-local (cli\_only)

`/snapshot` (/snap)

refused

HermesCLI.\_handle\_snapshot\_command

slash.exec: refused

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/start`

refused

messaging-only: unknown command

slash.exec: refused

slash.exec: refused

slash.exec: refused

messaging-only

`/status`

read

HermesCLI.\_show\_session\_status

canonical route

slash.exec (rpc fallback)

slash.exec

TUI session: main's `Hermes TUI Status`

`/statusbar` (/sb)

refused

HermesCLI.\_cmd\_statusbar

local (preference not saved)

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/steer` (/s)

refused

HermesCLI.\_cmd\_steer

canonical route

action: steer

session.steer

`/stop`

refused

HermesCLI.\_handle\_stop\_command

canonical route

action: stop

slash.exec: refused

`/subgoal`

control

HermesCLI.\_handle\_subgoal\_command

slash.exec

slash.exec

slash.exec

`/subscription` (/upgrade)

refused

HermesCLI.\_show\_subscription

sidecar: subscription.state

slash.exec: refused

slash.exec: refused

client-local (cli\_only)

`/suggestions` (/suggest)

read (bare only)

HermesCLI.\_handle\_suggestions\_command

slash.exec

slash.exec

slash.exec

`/timestamps` (/ts)

refused

HermesCLI.\_handle\_timestamps\_command

config.set

action: timestamps

slash.exec: refused

client-local (cli\_only)

`/title`

control

HermesCLI.\_cmd\_title

canonical route

action: title

session.mutate rename (bare: slash.exec)

`/tools`

refused

HermesCLI.\_handle\_tools\_command

refused: not available yet

slash.exec: refused

session.info

client-local (cli\_only)

`/toolsets`

read

HermesCLI.show\_toolsets

slash.exec

unavailable: terminal

slash.exec

client-local (cli\_only)

`/topic`

refused

messaging-only: unknown command

slash.exec: refused

slash.exec: refused

slash.exec: refused

messaging-only

`/topup`

read

HermesCLI.\_show\_billing

sidecar: billing.state

slash.exec

slash.exec

`/undo`

refused

HermesCLI.\_cmd\_undo

canonical route

action: undo

session.mutate rewind

`/update`

refused

HermesCLI.\_cmd\_update

local

unavailable: terminal

slash.exec: refused

`/usage`

read (bare only (`reset` refused))

HermesCLI.\_handle\_usage\_command

canonical route

slash.exec

slash.exec

`/verbose`

control

HermesCLI.\_toggle\_verbose

config.set

unavailable: terminal

slash.exec

per-session setting (gateway handler)

`/version` (/v)

read

HermesCLI.\_cmd\_version

slash.exec

slash.exec

slash.exec

`/voice`

control

HermesCLI.\_handle\_voice\_command

config.get, slash.exec; sidecar: voice.toggle; `tts` refused

unavailable: composer-voice

slash.exec

per-session setting (gateway handler)

`/wake`

refused

HermesCLI.\_handle\_wake\_command

local

action: wake

slash.exec: refused

client-local (cli\_only)

`/whoami`

read

HermesCLI.\_handle\_whoami\_command

slash.exec

slash.exec

slash.exec

`/worktree`

refused

HermesCLI.\_handle\_worktree\_command

slash.exec: refused

unavailable: terminal

slash.exec: refused

client-local (cli\_only)

`/yolo`

control

HermesCLI.\_toggle\_yolo

config.set

action: yolo

slash.exec

per-session setting (gateway handler)
