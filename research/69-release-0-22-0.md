# Hermes Agent v0.22.0 Release Notes

**Version:** v0.22.0
**Published:** 2026-10-14T03:21:46Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.22.0

# Hermes Agent v0.22.0

**Release Date:** October 13, 2026
**Since v0.21.0:** ~24,200 commits · ~6,080 merged PRs · ~15,600 files changed · ~2,045,000 insertions · ~1,140,000 deletions · **~7,180 issues closed** · ~2,520 contributors

> **The Threshold Release.** Hermes was the god of thresholds: the doorway, the crossing, the boundary stone. v0.21.0 assembled the pantheon; v0.22.0 is about getting through the door. A fresh desktop install now opens on a guided setup chat that runs on a free trial model, so a newcomer is talking to Hermes before they own an API key. Connectors carry the agent across into the apps you already use, with no account needed to start. Local models bring it home to your own hardware with a one-click llama.cpp runtime. And the threshold itself got sturdier: tested SemVer stable releases that installs follow by default, signed desktop packages (including the Microsoft Store), and one package manager underneath everything. Around that spine: a 600-plugin catalog, the Claude 5.5 / GPT-6 model wave, password-manager sign-in for the browser, a bot screen you can take over, one backend and one gateway for every profile, and a codebase a third smaller. This is the largest window Hermes has shipped, about 2.5x the v0.21.0 cycle, and it rolls up and fully documents the v0.21.1–v0.21.7 patch releases.

<!-- HERMES_BUILDS_TABLE -->

---

## ✨ Highlights

- **A first launch that sets itself up** — Open the desktop app on a computer where you have never used Hermes and it starts a short setup chat instead of a settings screen. One card at a time it asks your name, an accent color and a layout, which apps to connect, which plugins to install, then gives a quick tour and offers up to four first tasks picked for you. It runs on a free trial model (`nous/welcome`, once per OS user), so it needs no key; **Skip setup** ends it and **Settings → Run onboarding again** brings it back. The agent also gained `set_theme`, so "make it violet, dark mode" works in any desktop chat. ([#137429](https://github.com/NousResearch/hermes-agent/pull/137429), [#137522](https://github.com/NousResearch/hermes-agent/pull/137522), [#137807](https://github.com/NousResearch/hermes-agent/pull/137807), [#134209](https://github.com/NousResearch/hermes-agent/pull/134209), [#105258](https://github.com/NousResearch/hermes-agent/pull/105258) — @alt-glitch, @OutThisLife, @ethernet8023, @rewbs)

- **Connectors: Hermes works inside your apps** — The agent can now act in hosted apps such as Linear and Notion through the Nous tool gateway: ask for an app, sign in once in your browser, and the tools are usable in the same turn. You do not need a Nous account to start; the first time you use an app, Hermes creates a free connectors-only identity. The desktop has a new **Connectors** page that puts hosted apps and your MCP servers in one list (it replaces the MCP tab), the same setup card appears in the TUI and CLI, and you can connect several named accounts of one app (a `work` and a `home` account) and manage them with `/connectors` or `hermes connectors`. ([#106842](https://github.com/NousResearch/hermes-agent/pull/106842), [#111008](https://github.com/NousResearch/hermes-agent/pull/111008), [#119074](https://github.com/NousResearch/hermes-agent/pull/119074), [#135143](https://github.com/NousResearch/hermes-agent/pull/135143), [#135072](https://github.com/NousResearch/hermes-agent/pull/135072), [#135097](https://github.com/NousResearch/hermes-agent/pull/135097), [#135151](https://github.com/NousResearch/hermes-agent/pull/135151), [#135173](https://github.com/NousResearch/hermes-agent/pull/135173), [#137426](https://github.com/NousResearch/hermes-agent/pull/137426) — @alt-glitch, @rewbs)

- **Local models in one click** — Hermes can now run open models entirely on your machine with nothing leaving it: no account, no API key. It installs and maintains llama.cpp with the right engine for your hardware (CPU, CUDA, Metal, Vulkan or ROCm), rates every catalog model against your GPU and RAM, and picks the highest-quality build that fits. Downloads pause and resume, the server starts and stops with Hermes, and engine updates are one click. Start from **Settings → Providers → Local Models** on Windows, macOS and Linux, or `hermes model` → **Local models** in a terminal. The catalog includes Qwen3.8 27B, Qwen3.8 Flash Next (with its MTP speculative head), Qwen3.6 35B-A3B and DeepSeek V4 Flash, plus any GGUF from Hugging Face. ([#100667](https://github.com/NousResearch/hermes-agent/pull/100667), [#101823](https://github.com/NousResearch/hermes-agent/pull/101823), [#128768](https://github.com/NousResearch/hermes-agent/pull/128768), [#111423](https://github.com/NousResearch/hermes-agent/pull/111423), [#133111](https://github.com/NousResearch/hermes-agent/pull/133111), [#134116](https://github.com/NousResearch/hermes-agent/pull/134116) — @jquesnelle, @ethernet8023)

- **Stable release channels** — Hermes now ships tested SemVer releases. Every release passes source CI, Docker, Nix, signed desktop builds and install/upgrade runs on every OS before it is published, and source installs now move from release to release by default instead of tracking every commit on `main`. Prefer the bleeding edge? `hermes update --set-channel main`, or the new channel switch in Desktop **Settings → About**. Moving to an older release is labelled a rollback and never happens without asking, and installer reruns keep you on the channel you chose. ([#102765](https://github.com/NousResearch/hermes-agent/pull/102765), [#135847](https://github.com/NousResearch/hermes-agent/pull/135847), [#135949](https://github.com/NousResearch/hermes-agent/pull/135949), [#136313](https://github.com/NousResearch/hermes-agent/pull/136313), [#137780](https://github.com/NousResearch/hermes-agent/pull/137780) — @ethernet8023, @KoNit-K)

- **Signed desktop packages, the Microsoft Store, and one package manager** — The desktop app is now a sealed, signed package that carries its own Python and Node and updates itself, so first launch builds nothing. Windows gets a signed MSIX (x64 and ARM64) through App Installer or the Microsoft Store; macOS gets a signed, notarized build for Apple Silicon. Underneath, a new unified package manager (`hermes pm`) owns every pinned, hash-checked tool and Python environment: updates build a new environment and switch only once it passes its check, so a failed or killed update can no longer leave you half-applied. ([#102765](https://github.com/NousResearch/hermes-agent/pull/102765), [#132361](https://github.com/NousResearch/hermes-agent/pull/132361), [#132386](https://github.com/NousResearch/hermes-agent/pull/132386), [#120339](https://github.com/NousResearch/hermes-agent/pull/120339), [#122221](https://github.com/NousResearch/hermes-agent/pull/122221) — @ethernet8023)


- **The Plugin Catalog: 600 reviewed plugins** — The plugin catalog launched this cycle and grew to 600 entries, each pinned to a reviewed commit and installable from Hermes Desktop or the CLI. Browse by category and star ranking with a page per plugin and per author; catalog rules keep listed plugins from patching Hermes internals or shipping unscannable binaries. Memory providers now live with their makers (Honcho, Supermemory, Hindsight, Mem0, OpenViking, Holographic), as do Home Assistant, Spotify and Langfuse: existing users are migrated automatically, and the default install got leaner. ([#69446](https://github.com/NousResearch/hermes-agent/pull/69446), [#111415](https://github.com/NousResearch/hermes-agent/pull/111415), [#117808](https://github.com/NousResearch/hermes-agent/pull/117808), [#113381](https://github.com/NousResearch/hermes-agent/pull/113381), [#114732](https://github.com/NousResearch/hermes-agent/pull/114732), [#131267](https://github.com/NousResearch/hermes-agent/pull/131267), [#132476](https://github.com/NousResearch/hermes-agent/pull/132476), [#136436](https://github.com/NousResearch/hermes-agent/pull/136436) — @itpartypattaya, @happy5318, and 400+ plugin authors)

- **The Claude 5.5 and GPT-6 model wave** — Claude Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5, GPT-6 Astra, Sol and Luna plus GPT-6.1 Sol, and Gemini 4 Argon are pickable on Nous Portal, OpenRouter and native routes where offered. Prior reasoning is now replayed by default on every provider that can read it, across resume, branches and compaction, so long multi-step work keeps its train of thought. And when a provider has a bad hour, Hermes waits out transient 503/529/timeouts in visible, bounded cycles instead of ending your turn. ([#100577](https://github.com/NousResearch/hermes-agent/pull/100577), [#119304](https://github.com/NousResearch/hermes-agent/pull/119304), [#126842](https://github.com/NousResearch/hermes-agent/pull/126842), [#134759](https://github.com/NousResearch/hermes-agent/pull/134759), [#128248](https://github.com/NousResearch/hermes-agent/pull/128248), [#137955](https://github.com/NousResearch/hermes-agent/pull/137955), [#136358](https://github.com/NousResearch/hermes-agent/pull/136358), [#116353](https://github.com/NousResearch/hermes-agent/pull/116353) — @kshitijk4poor, @unsupportedpastels, @100yenadmin, @mssteuer, @xxxigm)

- **Sign in to websites with your password manager** — The browser agent can log into sites with logins from 1Password, Bitwarden or Hermes's own encrypted vault, and the model never sees the password. If nothing is saved, you get a masked prompt in the CLI, TUI or Desktop to save it, one-time codes are filled without entering the conversation, and card and address fills at checkout need your confirmation. ([#106480](https://github.com/NousResearch/hermes-agent/pull/106480), [#107585](https://github.com/NousResearch/hermes-agent/pull/107585), [#137084](https://github.com/NousResearch/hermes-agent/pull/137084))

- **Bot Screen: watch your bot work, take over when it needs you** — A bot running on a Linux gateway can have its own desktop that Hermes Desktop streams live. When it hits a login, a 2FA prompt or a CAPTCHA, you take the screen, finish the step yourself, and hand control back while the bot carries on with your session. With a Docker, SSH or Singularity backend, the bot's screen, computer use and the browser run inside the sandbox, never on your host. ([#108914](https://github.com/NousResearch/hermes-agent/pull/108914), [#121169](https://github.com/NousResearch/hermes-agent/pull/121169), [#121110](https://github.com/NousResearch/hermes-agent/pull/121110))

- **One backend and one gateway for every profile** — Hermes now runs a single messaging gateway and a single desktop backend per machine that serve all of your profiles, instead of one process per profile. Creating a profile makes its bots live without a restart, each profile keeps its own credentials, allowlists, cron jobs and sessions, and `hermes update` migrates existing per-profile setups automatically. Fewer processes, no token clashes, one thing to start and stop. ([#112854](https://github.com/NousResearch/hermes-agent/pull/112854), [#108928](https://github.com/NousResearch/hermes-agent/pull/108928), [#118273](https://github.com/NousResearch/hermes-agent/pull/118273), [#117983](https://github.com/NousResearch/hermes-agent/pull/117983), [#118246](https://github.com/NousResearch/hermes-agent/pull/118246), [#118027](https://github.com/NousResearch/hermes-agent/pull/118027))

- **See and steer your subagents live** — Running subagents now stay visible above the composer in the CLI (F6), TUI (Ctrl+T) and Desktop with each child's task, elapsed time and live transcript, plus Steer and Stop buttons. `/stop` reaches background children and hands back their partial work, and `delegate_task` can pass screenshots and mocks to vision-capable children. ([#105593](https://github.com/NousResearch/hermes-agent/pull/105593), [#115616](https://github.com/NousResearch/hermes-agent/pull/115616), [#97689](https://github.com/NousResearch/hermes-agent/pull/97689))

- **A model picker that knows your plans** — Star your favorite models, see a subscription running low ("17% left · resets 3:00 PM") and when a rate limit lifts right in the picker, and pick reasoning effort as part of choosing a model in `hermes model`, `/model` (`/model X --reasoning high`) and Desktop. You switch before you hit the wall instead of after. ([#126535](https://github.com/NousResearch/hermes-agent/pull/126535), [#133392](https://github.com/NousResearch/hermes-agent/pull/133392), [#133408](https://github.com/NousResearch/hermes-agent/pull/133408), [#110346](https://github.com/NousResearch/hermes-agent/pull/110346), [#113117](https://github.com/NousResearch/hermes-agent/pull/113117) — @OutThisLife, @anotherchu)

- **Hermes in your language, everywhere** — Every user-facing string in the CLI, messaging gateway, TUI and Desktop now goes through one translation catalog with full coverage in all 16 bundled languages. New languages can ship as plugins, and any profile can override individual strings with a small YAML file. ([#126296](https://github.com/NousResearch/hermes-agent/pull/126296))

- **Leaner in every sense** — The whole codebase was simplified with zero behavior change: source went from about 1.06M to 698K lines (−34%) and `gateway/run.py` shrank from 34,847 lines to 5,512. Prompts got lighter too: about 19 rarely used tools now load only when the agent searches for them, roughly halving the desktop tool schema sent on every call, and another ~2.1k tokens came off the fixed prompt. Local models prefill less on every turn. ([#102117](https://github.com/NousResearch/hermes-agent/pull/102117), [#97979](https://github.com/NousResearch/hermes-agent/pull/97979), [#106676](https://github.com/NousResearch/hermes-agent/pull/106676), [#137084](https://github.com/NousResearch/hermes-agent/pull/137084) — @alt-glitch)

- **Small comforts that add up** — Opt-in vim keys in the CLI prompt, a git-branch field in the status bar, a bell and desktop notification when Hermes is waiting on you, Ctrl+C that clears your draft instead of killing the turn, an editable `/queue`, and `hermes --native` to let your own terminal handle TUI scrollback and search. On Desktop, a new **Simple** mode turns the app into a plain chat window, and errors now say what went wrong with a one-click fix. ([#106412](https://github.com/NousResearch/hermes-agent/pull/106412), [#106434](https://github.com/NousResearch/hermes-agent/pull/106434), [#101284](https://github.com/NousResearch/hermes-agent/pull/101284), [#101320](https://github.com/NousResearch/hermes-agent/pull/101320), [#137065](https://github.com/NousResearch/hermes-agent/pull/137065), [#95999](https://github.com/NousResearch/hermes-agent/pull/95999), [#121035](https://github.com/NousResearch/hermes-agent/pull/121035), [#118587](https://github.com/NousResearch/hermes-agent/pull/118587), [#111601](https://github.com/NousResearch/hermes-agent/pull/111601) — @saforem2, @TurgutKural, @glitchbunny0, @harshmoney123, @pierrenode, @abhinav11082001-stack, @OutThisLife)

---

## ⚠️ Upgrade notes

- **Python 3.14 is the runtime** for managed installs (the package manager installs it for you). KittenTTS is unavailable on 3.14. ([#102765](https://github.com/NousResearch/hermes-agent/pull/102765))
- **Windows desktop is MSIX-only** and needs Windows 11 22H2 or newer; the NSIS/MSI installers are gone. The macOS app is Apple Silicon only in default builds. ([#102765](https://github.com/NousResearch/hermes-agent/pull/102765), [#136603](https://github.com/NousResearch/hermes-agent/pull/136603))
- **One gateway per machine is the default.** `hermes update` folds per-profile gateways into the multiplexed default when nothing conflicts. ([#112854](https://github.com/NousResearch/hermes-agent/pull/112854))
- **Chats no longer reset on an idle/daily timer.** `session_reset` idle/daily modes are retired (configs that still set them log a warning); `/new` or `/reset` starts fresh. ([#105021](https://github.com/NousResearch/hermes-agent/pull/105021), [#126244](https://github.com/NousResearch/hermes-agent/pull/126244))
- **Old sessions are pruned automatically.** `sessions.auto_prune` now defaults to on: ended sessions inactive for 90 days are deleted at startup. Pinned and open sessions are never touched; set `sessions.auto_prune: false` to keep everything.
- **Memory providers moved to catalog plugins** (Honcho, Supermemory, Hindsight, Mem0, OpenViking, Holographic), as did Home Assistant, Spotify and Langfuse. Existing users are migrated on update or first start, with data intact. ByteRover and RetainDB remain bundled.
- **Plugin authors:** the old plugin compatibility import layer is gone ([#126164](https://github.com/NousResearch/hermes-agent/pull/126164)), `hermes sync` (Skill Sync) was removed ([#132465](https://github.com/NousResearch/hermes-agent/pull/132465)), and the bundled tirith scanner was removed ([#133832](https://github.com/NousResearch/hermes-agent/pull/133832)). Several tools were renamed (`todo` → `todo_list`, `cronjob` → `cronjob_manage`, `process` → `process_manage`); the old names still work. ([#97979](https://github.com/NousResearch/hermes-agent/pull/97979))

---

## 🚪 Onboarding, Free Tier, Connectors & Local Models

### First-run onboarding
- **Guided setup chat on a fresh desktop install** *(see Highlights)*. Existing installs and remote (SSH, URL, Cloud) backends don't get it automatically; the old setup-profile flow and `/initiate-setup` are deleted. ([#137420](https://github.com/NousResearch/hermes-agent/pull/137420), [#134215](https://github.com/NousResearch/hermes-agent/pull/134215), [#108292](https://github.com/NousResearch/hermes-agent/pull/108292) — @alt-glitch, @ethernet8023, @OutThisLife)
- **The agent can restyle the app** — The new `set_theme` tool sets the accent (a swatch or any `#rrggbb`), light/dark/system mode and layout, or shows a picker; "make it violet" works in any desktop chat. ([#137522](https://github.com/NousResearch/hermes-agent/pull/137522) — @alt-glitch)

### Nous free tier
- **A free model for your first desktop launch** — A first desktop install with no provider or Nous account gets the free `nous/welcome` model as a one-time trial (once per OS user), so onboarding needs no key. The CLI, TUI and gateway get no account or free model. `HERMES_GUEST_ONBOARDING` is gone. ([#137807](https://github.com/NousResearch/hermes-agent/pull/137807), [#105258](https://github.com/NousResearch/hermes-agent/pull/105258), [#105260](https://github.com/NousResearch/hermes-agent/pull/105260) — @alt-glitch)
- **Sign in and keep your apps** — `hermes auth upgrade`, or `/login` in any chat or messaging DM, upgrades the free identity to a full Nous account with your connected apps. ([#105259](https://github.com/NousResearch/hermes-agent/pull/105259), [#105261](https://github.com/NousResearch/hermes-agent/pull/105261) — @alt-glitch)
- **Clear limits** — The free rate limit ends the turn at once with the reset time; every free-tier failure has a code and a plain sentence; the app handles the account service's browser check; free-tier users see a Terms and Privacy notice. Nous accounts without credits can pick models billed to a subscription they hold and get free managed fast web search. ([#134049](https://github.com/NousResearch/hermes-agent/pull/134049), [#111970](https://github.com/NousResearch/hermes-agent/pull/111970), [#133824](https://github.com/NousResearch/hermes-agent/pull/133824), [#117079](https://github.com/NousResearch/hermes-agent/pull/117079) — @alt-glitch, @kshitijk4poor, @rewbs)

### Connectors
- **Hosted app connectors, the Connectors page and several accounts per app** *(see Highlights)*. Connector tools can also send your local files as attachments and save the files they return. `nous.guest: false` turns guest identities off; `tools.connectors.enabled: false` turns connectors off. ([#111238](https://github.com/NousResearch/hermes-agent/pull/111238), [#138014](https://github.com/NousResearch/hermes-agent/pull/138014) — @alt-glitch)
- **One connect flow everywhere** — Hosted apps and local MCP servers share one setup card (desktop dialog, TUI callout or CLI panel), and the agent can use new tools in the same turn. On desktop, `manage_connections` can show a browsable app directory. ([#111008](https://github.com/NousResearch/hermes-agent/pull/111008), [#109517](https://github.com/NousResearch/hermes-agent/pull/109517), [#137426](https://github.com/NousResearch/hermes-agent/pull/137426) — @alt-glitch)

### Local models
- **One-click local models** *(see Highlights)*. Also: Hugging Face GGUF downloads with pause/resume, and a one-time setup offer after onboarding on machines that can run the recommended model. ([#129506](https://github.com/NousResearch/hermes-agent/pull/129506) — @alt-glitch)
- **Engine updates and wider GPU support** — An **Update now** prompt updates the engine in one click. NVIDIA on Linux gets CUDA, AMD and Intel GPUs get Vulkan sized by their own memory, and every backend runs llama.cpp b11370. ([#111423](https://github.com/NousResearch/hermes-agent/pull/111423), [#133111](https://github.com/NousResearch/hermes-agent/pull/133111), [#131782](https://github.com/NousResearch/hermes-agent/pull/131782) — @jquesnelle, @skyecon, @mbeattietex1-star, @Belaquaa)
- **Better recommendations** — Only models that fit fully in GPU memory are recommended, and the 27B no longer on hardware that runs it poorly. Qwen3.8 Flash Next with its MTP head fits 128 GB machines; NVIDIA Spark recommendations are tuned. ([#108429](https://github.com/NousResearch/hermes-agent/pull/108429), [#135438](https://github.com/NousResearch/hermes-agent/pull/135438), [#134116](https://github.com/NousResearch/hermes-agent/pull/134116), [#112107](https://github.com/NousResearch/hermes-agent/pull/112107) — @jquesnelle, @RyanUnderhill)
- **Your own local servers** — LM Studio has a provider profile, Ollama pickers no longer flicker, a self-started llama.cpp server shows up in `/model`, and fallback to the desktop-managed model works. ([#134320](https://github.com/NousResearch/hermes-agent/pull/134320), [#113129](https://github.com/NousResearch/hermes-agent/pull/113129), [#116679](https://github.com/NousResearch/hermes-agent/pull/116679), [#131795](https://github.com/NousResearch/hermes-agent/pull/131795) — @kshitijk4poor, @DaxLee9988, @fangliquanflq, @Finn763, @albeight)

## 📦 Stable Releases, Desktop Packages & Package Manager

### Stable releases & update channels
- **Tested SemVer stable releases and the channel switch** *(see Highlights)*. v0.21.6 and v0.21.7 were the first through the new gate; forks stay on `main`, and an install ahead of the newest release waits for the next.
- **Lighter update checks** — one GitHub API call a day replaces `git fetch` every 30 minutes. ([#107648](https://github.com/NousResearch/hermes-agent/pull/107648))

### Desktop bundles & the Microsoft Store
- **Sealed, signed desktop packages** *(see Highlights)*. In a package, `hermes update` points to the right updater (App Installer, Store or macOS). ([#134911](https://github.com/NousResearch/hermes-agent/pull/134911))
- **Packaged installs work end to end** — the agent's terminal runs `hermes`, Uninstall explains OS removal, and Python-dependency plugins install inside MSIX. ([#134051](https://github.com/NousResearch/hermes-agent/pull/134051), [#135333](https://github.com/NousResearch/hermes-agent/pull/135333) — @alt-glitch)

### Unified package manager
- **`hermes pm`** *(see Highlights)*: pinned, hash-checked Python 3.14, uv, Node, ripgrep, FFmpeg, Chromium and Git/Bash on Windows, with `hermes pm doctor|status|repair|gc`. Contributors use `source ./activate` (or `.ps1`/`.fish`).
- **Dependency environments are generations** — new ones are checked before use, so a failed install keeps the working one; updates and `hermes pm gc` reclaim old ones (92 GB to 18 GB on one host). ([#124968](https://github.com/NousResearch/hermes-agent/pull/124968), [#133808](https://github.com/NousResearch/hermes-agent/pull/133808) — @JoaoMarcos44)
- **Optional features install on first use** — opt-in SDKs (Anthropic, Bedrock) load mid-session without a restart; `security.allow_lazy_installs: false` turns this off. ([#122221](https://github.com/NousResearch/hermes-agent/pull/122221) — @ethernet8023)
- **Plugins declare Python dependencies** — resolved with core across profiles; conflicts are refused, and updates disable a plugin that no longer fits. Hindsight, Honcho, Supermemory, Mem0 and Home Assistant moved to the catalog and auto-install where used. ([#113851](https://github.com/NousResearch/hermes-agent/pull/113851), [#122103](https://github.com/NousResearch/hermes-agent/pull/122103), [#114569](https://github.com/NousResearch/hermes-agent/pull/114569), [#132469](https://github.com/NousResearch/hermes-agent/pull/132469) — @ethernet8023)

### Install & update
- **Updates can't half-apply** *(see Highlights)*. A killed update repairs itself on the next launch. ([#132361](https://github.com/NousResearch/hermes-agent/pull/132361), [#120339](https://github.com/NousResearch/hermes-agent/pull/120339))
- **Faster updates, smaller checkouts** — updates rebuild only what changed (16.5 s vs 32.5 s on macOS), clones are blobless, and partial-clone `.git` growth is fixed. ([#135092](https://github.com/NousResearch/hermes-agent/pull/135092), [#133016](https://github.com/NousResearch/hermes-agent/pull/133016), [#131679](https://github.com/NousResearch/hermes-agent/pull/131679) — @kshitijk4poor, @ethernet8023, @liuhao1024, @whyyagswhy)
- **Small, hash-checked installers** — `install.sh`/`install.ps1` verify pinned uv and Git, hand off to PM, log to `logs/install.log`, and now work on musl Linux (Alpine, Void), Windows 10 and Unicode Windows paths. ([#124964](https://github.com/NousResearch/hermes-agent/pull/124964), [#125598](https://github.com/NousResearch/hermes-agent/pull/125598), [#132430](https://github.com/NousResearch/hermes-agent/pull/132430) — @JoaoMarcos44, @kshitijk4poor, @Finn763, @OutThisLife)
- **Failures say why** — with opt-in telemetry, install, update, skill and plugin failures record a reason. ([#133809](https://github.com/NousResearch/hermes-agent/pull/133809))

### Docker / Nix / Termux / Windows
- **Docker** — pinned Debian 13 base with full Chromium; `stable`/`latest` move only on a published release; baked-in extras return after a restart. ([#135726](https://github.com/NousResearch/hermes-agent/pull/135726), [#135084](https://github.com/NousResearch/hermes-agent/pull/135084) — @unsupportedpastels)
- **Nix, Termux, Windows** — Nix shares the pins; its desktop app gets Wayland; Termux moves to a signed APT package (`pkg upgrade hermes-agent`), though its docs still warn it is broken; Windows updates finish while the old runtime is in use. ([#128144](https://github.com/NousResearch/hermes-agent/pull/128144), [#122146](https://github.com/NousResearch/hermes-agent/pull/122146), [#131779](https://github.com/NousResearch/hermes-agent/pull/131779) — @ethernet8023, @janviernine)

### CI & release engineering
- **Release gates** — E2E suites run on release builds, the full suite on native Windows, and SSH/Docker backends against real daemons. ([#135409](https://github.com/NousResearch/hermes-agent/pull/135409), [#96458](https://github.com/NousResearch/hermes-agent/pull/96458), [#136602](https://github.com/NousResearch/hermes-agent/pull/136602) — @ethernet8023)

## 🧠 Providers & Models

### New providers
- **Providers as plugins** — ACP and CLI-driven providers install out of tree via `hermes plugins install`; `--provider chatgpt` picks ChatGPT Codex OAuth. ([#101456](https://github.com/NousResearch/hermes-agent/pull/101456), [#115761](https://github.com/NousResearch/hermes-agent/pull/115761) — @AlexanderPrendota, @DarRahman)
- **Provider upgrades** — Bedrock serves GPT-6 (1M) and enforces Claude Guardrails; Azure Foundry lists deployments; Gemini takes full JSON Schema tools; OpenCode Go routes Claude via Messages. ([#133573](https://github.com/NousResearch/hermes-agent/pull/133573), [#107815](https://github.com/NousResearch/hermes-agent/pull/107815), [#115770](https://github.com/NousResearch/hermes-agent/pull/115770), [#98928](https://github.com/NousResearch/hermes-agent/pull/98928), [#134848](https://github.com/NousResearch/hermes-agent/pull/134848) — @victor-kyriazakos, @JoaoMarcos44, @xxxigm, @thejpanganiban, @pandacooming)
- **New knobs** — `agent.text_verbosity` sets Responses answer length; named custom providers run on the Codex app-server. ([#115880](https://github.com/NousResearch/hermes-agent/pull/115880), [#115905](https://github.com/NousResearch/hermes-agent/pull/115905) — @Beandon13, @cosin2077)
### Model catalog
- **Claude 5.x** — Opus 5.5 also on native Anthropic and Bedrock (1M). ([#122633](https://github.com/NousResearch/hermes-agent/pull/122633) — @kshitijk4poor, @didodim)
- **GPT-6** — Astra/Astra Pro in standard, fast and flex; opt-in Codex `-900k`; `/fast ultrafast` for Astra and 6.1 Sol, per plan. ([#103261](https://github.com/NousResearch/hermes-agent/pull/103261), [#119410](https://github.com/NousResearch/hermes-agent/pull/119410), [#136950](https://github.com/NousResearch/hermes-agent/pull/136950) — @daniil-grois, @sdalonzo)
- **Gemini 3.8 Flash and Gemini 4 Argon**. ([#101450](https://github.com/NousResearch/hermes-agent/pull/101450), [#137989](https://github.com/NousResearch/hermes-agent/pull/137989) — @kshitijk4poor, @dgkaaks)
- **More** — DeepSeek V4.1 Flash, Qwen3.8-Max-0902, Grok 4.7, GLM-5.3-FlashX, Muse Spark 1.3, Solar Pro 4/Mini 4. ([#107489](https://github.com/NousResearch/hermes-agent/pull/107489), [#100966](https://github.com/NousResearch/hermes-agent/pull/100966), [#118371](https://github.com/NousResearch/hermes-agent/pull/118371), [#117435](https://github.com/NousResearch/hermes-agent/pull/117435), [#101948](https://github.com/NousResearch/hermes-agent/pull/101948), [#131645](https://github.com/NousResearch/hermes-agent/pull/131645) — @rob-maron, @am423)
### Auth & subscriptions
- **Profiles share OAuth logins safely** — single-use grants never fork; a profile's own login is kept. ([#100929](https://github.com/NousResearch/hermes-agent/pull/100929), [#134574](https://github.com/NousResearch/hermes-agent/pull/134574) — @unsupportedpastels)
- **Nous sign-in survives** hourly expiry, concurrent subagents, Portal outages and edge checks. ([#103526](https://github.com/NousResearch/hermes-agent/pull/103526), [#121488](https://github.com/NousResearch/hermes-agent/pull/121488) — @kshitijk4poor, @zzragida)
- **Dead logins are named once**, with the `hermes auth add` fix; `auth.adopt_external_logins: false` stops borrowing Codex CLI/Claude Code logins. ([#113816](https://github.com/NousResearch/hermes-agent/pull/113816), [#115586](https://github.com/NousResearch/hermes-agent/pull/115586))
- **Keys stay on their hosts** — configured `base_url` honored everywhere; Anthropic/OpenAI keys never reach foreign hosts. ([#121614](https://github.com/NousResearch/hermes-agent/pull/121614), [#120299](https://github.com/NousResearch/hermes-agent/pull/120299) — @austinpickett, @686f6c61, @ahisblessed, @xuezhaolan, @leemove)
### Routing/fallback/caching
- **Outage recovery** — `agent.auto_recovery_cycles` (default 5) bounds the wait; fallback returns to a Codex primary whose quota reopened. ([#116353](https://github.com/NousResearch/hermes-agent/pull/116353), [#130716](https://github.com/NousResearch/hermes-agent/pull/130716) — @kshitijk4poor, @xxxigm)
- **No surprise billing** — auto-routing never bills a provider you didn't pick; `provider_routing.models` pins OpenRouter per model. ([#107366](https://github.com/NousResearch/hermes-agent/pull/107366), [#104159](https://github.com/NousResearch/hermes-agent/pull/104159))
- **Prompt caching** — opt-in `cache_ttl: auto` (1h interactive, 5m subagents/cron); big sessions confirm a cache-breaking `/model`; compaction keeps the prefix. ([#118337](https://github.com/NousResearch/hermes-agent/pull/118337), [#95267](https://github.com/NousResearch/hermes-agent/pull/95267), [#104455](https://github.com/NousResearch/hermes-agent/pull/104455) — @kshitijk4poor, @JoaoMarcos44)
### Reasoning
- **Replay and effort** — reasoning replays on every provider that reads it; effort on every picker, custom tier names; Anthropic fast mode follows the docs. ([#136358](https://github.com/NousResearch/hermes-agent/pull/136358), [#110346](https://github.com/NousResearch/hermes-agent/pull/110346), [#115735](https://github.com/NousResearch/hermes-agent/pull/115735), [#120517](https://github.com/NousResearch/hermes-agent/pull/120517) — @jquesnelle)

## 🏗️ Core Agent, Sessions & Memory

### Agent loop & reliability
- **Stalled turns recover** — a watchdog (`agent.turn_liveness.timeout_s`, default 600 s) interrupts a no-progress turn and frees its session; repeated transcript repairs now raise one error and notice. ([#99758](https://github.com/NousResearch/hermes-agent/pull/99758), [#99687](https://github.com/NousResearch/hermes-agent/pull/99687) — @kshitijk4poor, @Finn763, @HexLab98)
- **Streams fail less and report honestly** — text-less dead streams retry, repetition loops are cut, and interrupted turns aren't reported as done. ([#113135](https://github.com/NousResearch/hermes-agent/pull/113135), [#130551](https://github.com/NousResearch/hermes-agent/pull/130551), [#112272](https://github.com/NousResearch/hermes-agent/pull/112272) — @kshitijk4poor)

### Compression & context
- **Compaction triggers on real token counts** — provider-reported usage, not bytes/4; the protected tail is capped at 20% so small-window models compact. ([#104555](https://github.com/NousResearch/hermes-agent/pull/104555), [#117957](https://github.com/NousResearch/hermes-agent/pull/117957) — @686f6c61)
- **Bad summaries can't wipe context** — refusals and overloaded summary providers leave the transcript alone, and an uncommitted compaction changes nothing. ([#118920](https://github.com/NousResearch/hermes-agent/pull/118920), [#115906](https://github.com/NousResearch/hermes-agent/pull/115906), [#136083](https://github.com/NousResearch/hermes-agent/pull/136083) — @kshitijk4poor, @fangliquanflq, @mnajafian-nv)
- **New knobs** — provider-scoped `compression.model_thresholds` keys and `auxiliary.<task>.no_progress_timeout`. ([#108061](https://github.com/NousResearch/hermes-agent/pull/108061), [#115804](https://github.com/NousResearch/hermes-agent/pull/115804) — @chelsealong)

### Sessions & state.db
- **state.db reliability** — lock timeouts name the holding process, a busy database no longer kills a turn, and sibling PID namespaces can't steal leases. ([#116967](https://github.com/NousResearch/hermes-agent/pull/116967), [#134577](https://github.com/NousResearch/hermes-agent/pull/134577), [#132161](https://github.com/NousResearch/hermes-agent/pull/132161) — @kshitijk4poor, @686f6c61)
- **state.db stops growing** — auto-prune is on by default (ended sessions over 90 days) and closes stale cron/kanban/subagent sessions; VACUUM runs only when 25% is reclaimable. ([#101316](https://github.com/NousResearch/hermes-agent/pull/101316), [#100903](https://github.com/NousResearch/hermes-agent/pull/100903) — @stepanov1975)
- **Repair commands** — `hermes sessions set-journal-mode delete|wal`, `repair-profiles` (crossed profiles) and `repair-prompts`. ([#117684](https://github.com/NousResearch/hermes-agent/pull/117684), [#115689](https://github.com/NousResearch/hermes-agent/pull/115689), [#124200](https://github.com/NousResearch/hermes-agent/pull/124200) — @kshitijk4poor, @JoaoMarcos44)
- **Cleaner session lists** — one-shot runs stay out of pickers, `sessions.show_subagents` lists titled subagent chats, messages get stable ids for context engines. ([#113826](https://github.com/NousResearch/hermes-agent/pull/113826), [#122304](https://github.com/NousResearch/hermes-agent/pull/122304), [#126687](https://github.com/NousResearch/hermes-agent/pull/126687) — @OutThisLife, @kshitijk4poor, @100yenadmin)

### Memory
- **Memory providers leave core safely** — OpenViking and Holographic move to the plugin catalog on update or first start, data intact, or say why not. ([#134350](https://github.com/NousResearch/hermes-agent/pull/134350), [#136436](https://github.com/NousResearch/hermes-agent/pull/136436), [#131269](https://github.com/NousResearch/hermes-agent/pull/131269))
- **Built-in memory writes land** — hand-formatted MEMORY.md/USER.md accepted, refusals say what to fix, secrets scrubbed before providers see them. ([#133038](https://github.com/NousResearch/hermes-agent/pull/133038), [#134429](https://github.com/NousResearch/hermes-agent/pull/134429) — @aniruddhaadak80)

### Profiles & config
- **config.yaml survives bad moments** — a broken file falls back to the last good copy; read errors can't wipe it. ([#109463](https://github.com/NousResearch/hermes-agent/pull/109463), [#120343](https://github.com/NousResearch/hermes-agent/pull/120343) — @Shenrui-Ma, @huklaa)
- **Safer `hermes config`** — `get` masks secrets (`--raw` opts out); `set` refuses typo paths and stores env-style names in `.env`. ([#111341](https://github.com/NousResearch/hermes-agent/pull/111341), [#112250](https://github.com/NousResearch/hermes-agent/pull/112250) — @webtecnica)
- **Profiles stay separate** — REST routes act on the profile they name, exports skip `.ssh`/`.aws`/`.gnupg`, and `import-agent --sync` keeps imports current. ([#118275](https://github.com/NousResearch/hermes-agent/pull/118275), [#132201](https://github.com/NousResearch/hermes-agent/pull/132201), [#88855](https://github.com/NousResearch/hermes-agent/pull/88855) — @kshitijk4poor, @JerryLiu369)

### Languages (i18n)
- **Language packs** — any language can ship as a plugin (`provides_locales`) or a per-profile override file. ([#126296](https://github.com/NousResearch/hermes-agent/pull/126296))

## 📱 Messaging Platforms (Gateway)

### Gateway core & multiplexing
- **One gateway serves every profile** — `hermes gateway status` explains any boot-guard refusal, `hermes gateway migrate --multiplex` migrates by hand, webhook platforms serve each profile at `/p/<profile>/`, `hermes -p X gateway stop|start` parks one profile, and `gateway.standalone: true` is a temporary opt-out. ([#112854](https://github.com/NousResearch/hermes-agent/pull/112854), [#108952](https://github.com/NousResearch/hermes-agent/pull/108952), [#119774](https://github.com/NousResearch/hermes-agent/pull/119774), [#119680](https://github.com/NousResearch/hermes-agent/pull/119680) — @victor-kyriazakos)
- **Profiles stay isolated** — clones skip bot tokens unless `--clone-channels`; `profile_routes` can route by sender. ([#109502](https://github.com/NousResearch/hermes-agent/pull/109502), [#115642](https://github.com/NousResearch/hermes-agent/pull/115642) — @italodsfernandes)
- **Sessions and commands** — `/login` signs free-tier users in from a DM; idle/daily `session_reset` is retired, so only `/new` and `/reset` start fresh; `/branch` opens a sibling thread on Discord, Telegram, Slack and Matrix (`--here` keeps the old behavior); `decline` mode sends unauthorized DMs one polite refusal; an opt-in `served_model` footer names the model that answered. ([#105261](https://github.com/NousResearch/hermes-agent/pull/105261), [#126244](https://github.com/NousResearch/hermes-agent/pull/126244), [#117450](https://github.com/NousResearch/hermes-agent/pull/117450), [#88028](https://github.com/NousResearch/hermes-agent/pull/88028), [#115925](https://github.com/NousResearch/hermes-agent/pull/115925) — @alt-glitch, @kshitijk4poor, @anpicasso)
- **Files and plugins** — `MEDIA:` files from ssh/Modal/Daytona sandboxes reach the user; plugins can claim messages via `post_gateway_admission`. ([#103600](https://github.com/NousResearch/hermes-agent/pull/103600), [#133157](https://github.com/NousResearch/hermes-agent/pull/133157) — @kshitijk4poor, @tokou)

### Messaging platforms
- **Telegram** — opt-in `bots_require_mention` stops bot reply loops, `extra.drop_pending_on_cold_boot: false` keeps messages sent while offline, CJK can opt in to rich messages. ([#106534](https://github.com/NousResearch/hermes-agent/pull/106534), [#116134](https://github.com/NousResearch/hermes-agent/pull/116134), [#111831](https://github.com/NousResearch/hermes-agent/pull/111831) — @kshitijk4poor, @kokhlo, @justcarlosm, @wang2)
- **Discord** — setup verifies the token, links the Message Content Intent and allowlists you; free-response channels can auto-thread. ([#132456](https://github.com/NousResearch/hermes-agent/pull/132456), [#116168](https://github.com/NousResearch/hermes-agent/pull/116168) — @kshitijk4poor, @FunJim)
- **Slack** — Block Kit `/model` picker; status/titles use the Agent Sessions API. ([#103436](https://github.com/NousResearch/hermes-agent/pull/103436), [#101477](https://github.com/NousResearch/hermes-agent/pull/101477) — @kshitijk4poor, @sohomsahaun)
- **WhatsApp** — native mentions via `hermes send --mention`, no 5 s batching delay, paired sessions on every profile. ([#115253](https://github.com/NousResearch/hermes-agent/pull/115253), [#117104](https://github.com/NousResearch/hermes-agent/pull/117104), [#132518](https://github.com/NousResearch/hermes-agent/pull/132518) — @kshitijk4poor, @unsupportedpastels, @Diaspar4u)
- **Signal, Matrix, Email, QQ Bot** — Signal tables render monospace; Matrix LaTeX typesets in Element (Labs math setting); Email refuses spoofed senders and now requires an `authserv_id` pin (mail drops until set); QQ Bot `send_message` delivers media. ([#106538](https://github.com/NousResearch/hermes-agent/pull/106538), [#106515](https://github.com/NousResearch/hermes-agent/pull/106515), [#132663](https://github.com/NousResearch/hermes-agent/pull/132663), [#131927](https://github.com/NousResearch/hermes-agent/pull/131927) — @chelsealong, @romanovzky, @kshitijk4poor, @OutThisLife, @cadezhou)

### Webhooks & API server
- **Webhooks** — opt-in `coalesce` folds event bursts into one run, `cron_job` routes fire cron jobs on events, Standard Webhooks signatures verify, opt-in `mirror_to_session` gives replies context. ([#92066](https://github.com/NousResearch/hermes-agent/pull/92066), [#95262](https://github.com/NousResearch/hermes-agent/pull/95262), [#104183](https://github.com/NousResearch/hermes-agent/pull/104183), [#120825](https://github.com/NousResearch/hermes-agent/pull/120825) — @HwangJohn, @Potrock)
- **API server** — reasoning streams to OpenAI-compatible clients; stream approvals are answerable. ([#115797](https://github.com/NousResearch/hermes-agent/pull/115797), [#121769](https://github.com/NousResearch/hermes-agent/pull/121769) — @kshitijk4poor, @liuhao1024)

### Relay & Bot Chat
- **Bot Mode rooms** — edit members, Reply to @handle, 200-message history, sender-aware bot DMs with an `ALLOW_BOTS` loop guard. ([#113384](https://github.com/NousResearch/hermes-agent/pull/113384), [#107520](https://github.com/NousResearch/hermes-agent/pull/107520) — @erosika, @69k4xmdfm2-blip)
- **Relay** — connector checks `send_message` targets; NeMo Relay tracing at 0.10.0 tags spans with the working directory. ([#99220](https://github.com/NousResearch/hermes-agent/pull/99220), [#135787](https://github.com/NousResearch/hermes-agent/pull/135787), [#108345](https://github.com/NousResearch/hermes-agent/pull/108345) — @benbarclay, @mnajafian-nv, @afourniernv, @KoNit-K)

## 🖥️ Desktop App

### Workspace & layout
- **Simple / Advanced mode** — Simple hides developer panes; Advanced stays the default. ([#118587](https://github.com/NousResearch/hermes-agent/pull/118587) — @OutThisLife)
- **Windows and tabs** — Titlebar tabs; profiles open in their own window or as startup default. ([#107099](https://github.com/NousResearch/hermes-agent/pull/107099), [#113176](https://github.com/NousResearch/hermes-agent/pull/113176) — @OutThisLife)
- **Sidebar** — Group by gateway/profile, reuse Cloud instances, drag New session onto a pane. ([#105813](https://github.com/NousResearch/hermes-agent/pull/105813), [#70571](https://github.com/NousResearch/hermes-agent/pull/70571) — @abundantbeing)
- **Import sessions** — Continue another coding agent's transcript in Hermes. ([#104229](https://github.com/NousResearch/hermes-agent/pull/104229) — @Adolanium)
- **Goal / Loop / Heartbeat cards** — Live pause/resume/stop above the composer. ([#104246](https://github.com/NousResearch/hermes-agent/pull/104246) — @jerrygooch)
- **Launch options** — Start on a fresh chat; opt-in tray minimize and Cmd+Option / Ctrl+Alt HUD tap. ([#101304](https://github.com/NousResearch/hermes-agent/pull/101304), [#118441](https://github.com/NousResearch/hermes-agent/pull/118441), [#118446](https://github.com/NousResearch/hermes-agent/pull/118446) — @jinglun010-cpu, @OutThisLife)
### Chat & composer
- **Pickers and input** — Reasoning-effort pill; add a model by slug; 3,000+ char pastes attach as .txt; opt-in macOS window-screenshot shortcut. ([#109907](https://github.com/NousResearch/hermes-agent/pull/109907), [#120693](https://github.com/NousResearch/hermes-agent/pull/120693), [#108901](https://github.com/NousResearch/hermes-agent/pull/108901), [#113349](https://github.com/NousResearch/hermes-agent/pull/113349) — @OutThisLife)
- **Actionable errors** — Cards name the problem and fix; usage-limit cards show reset time and can schedule a retry. ([#111601](https://github.com/NousResearch/hermes-agent/pull/111601), [#116288](https://github.com/NousResearch/hermes-agent/pull/116288))
- **Transcript** — Stable approval queue; hideable code diffs. ([#107073](https://github.com/NousResearch/hermes-agent/pull/107073), [#116569](https://github.com/NousResearch/hermes-agent/pull/116569) — @OutThisLife)
- **Browser comment mode** — Pin page elements with notes; crops, selectors and styles go to the composer. ([#100083](https://github.com/NousResearch/hermes-agent/pull/100083) — @Adolanium)
### Settings & plugins
- **Settings** — Ordered subpages searchable from ⌘K; Chat Font (e.g. OpenDyslexic); Russian, French, German, Spanish. ([#117127](https://github.com/NousResearch/hermes-agent/pull/117127), [#111226](https://github.com/NousResearch/hermes-agent/pull/111226), [#100429](https://github.com/NousResearch/hermes-agent/pull/100429) — @OutThisLife, @warment, @FASTCHIP)
- **Models** — Per-task auxiliary reasoning effort; Custom Endpoints pick an API mode. ([#110435](https://github.com/NousResearch/hermes-agent/pull/110435), [#115851](https://github.com/NousResearch/hermes-agent/pull/115851) — @higgs1729, @SacrEllfarch)
- **Plugins** — One row per plugin; composer and settings APIs. ([#107314](https://github.com/NousResearch/hermes-agent/pull/107314), [#120907](https://github.com/NousResearch/hermes-agent/pull/120907) — @OutThisLife, @Heybinshao)
### Bot Mode
- **Bot Screen** — Linux-gateway bots stream a desktop you can take over for logins or 2FA. Off by default; needs host packages. ([#108914](https://github.com/NousResearch/hermes-agent/pull/108914))
- **Group chats** — Reorder rooms; compress a member's hidden history. ([#105909](https://github.com/NousResearch/hermes-agent/pull/105909), [#117015](https://github.com/NousResearch/hermes-agent/pull/117015))
### Performance & platforms
- **One backend** — Desktop attaches to the running backend, which serves every profile. ([#118246](https://github.com/NousResearch/hermes-agent/pull/118246))
- **Platforms** — Faster Windows startup; Linux runs without sudo and under WSLg/Wayland. ([#111002](https://github.com/NousResearch/hermes-agent/pull/111002), [#100136](https://github.com/NousResearch/hermes-agent/pull/100136), [#113247](https://github.com/NousResearch/hermes-agent/pull/113247) — @codeJRV, @kvnloo, @austinpickett)

### Models, chat & workspace
- **Model picker knows your plans** — Star Favorites; provider rows show when a rate limit lifts and a "17% left · resets 3:00 PM" chip before you hit it. Also opt-in per-model pricing with cached-read rates, an Ultrafast speed tier and keys to step reasoning effort. ([#126535](https://github.com/NousResearch/hermes-agent/pull/126535), [#133392](https://github.com/NousResearch/hermes-agent/pull/133392), [#133408](https://github.com/NousResearch/hermes-agent/pull/133408), [#126651](https://github.com/NousResearch/hermes-agent/pull/126651), [#132445](https://github.com/NousResearch/hermes-agent/pull/132445), [#125800](https://github.com/NousResearch/hermes-agent/pull/125800) — @OutThisLife, @kshitijk4poor, @anotherchu)
- **Safer rewinds and honest stops** — Regenerate or edit asks before archiving more than one later turn; Stop shows the partial reply the session saves. ([#133748](https://github.com/NousResearch/hermes-agent/pull/133748), [#121597](https://github.com/NousResearch/hermes-agent/pull/121597) — @kshitijk4poor)
- **Reading and layout** — Chat Text Size separate from UI Scale; theme typography; lightbox zoom/pan; compression count in the context meter; context-aware right-click. ([#128975](https://github.com/NousResearch/hermes-agent/pull/128975), [#125904](https://github.com/NousResearch/hermes-agent/pull/125904), [#127247](https://github.com/NousResearch/hermes-agent/pull/127247), [#126653](https://github.com/NousResearch/hermes-agent/pull/126653), [#131215](https://github.com/NousResearch/hermes-agent/pull/131215) — @OutThisLife, @unsupportedpastels, @dskwe)
- **Workspace and sessions** — Sessions follow the agent's git worktree and branch; Review pane scopes work. Browse SSH workspaces, drag sessions onto projects, search logs, see and clear Kanban blocks. ([#128428](https://github.com/NousResearch/hermes-agent/pull/128428), [#127200](https://github.com/NousResearch/hermes-agent/pull/127200), [#99538](https://github.com/NousResearch/hermes-agent/pull/99538), [#126543](https://github.com/NousResearch/hermes-agent/pull/126543), [#126658](https://github.com/NousResearch/hermes-agent/pull/126658), [#125647](https://github.com/NousResearch/hermes-agent/pull/125647) — @ethernet8023, @OutThisLife, @nateEc)
- **Preview and voice** — Preview opens public web pages; YouTube plays via a local player. Non-streaming TTS speaks from the first sentence; quiet-audio STT hallucinations are filtered. ([#130393](https://github.com/NousResearch/hermes-agent/pull/130393), [#130975](https://github.com/NousResearch/hermes-agent/pull/130975), [#121685](https://github.com/NousResearch/hermes-agent/pull/121685), [#127275](https://github.com/NousResearch/hermes-agent/pull/127275) — @xxxigm, @OutThisLife, @kshitijk4poor, @embwl0x)

### Plugins, updates & the app
- **Settings ▸ Plugins and a bigger SDK** — Every plugin gets a settings page (agent plugins from their config schema). Desktop plugins can run app actions by id, speak via the pet, add Appearance controls and reorder sidebar nav. ([#133182](https://github.com/NousResearch/hermes-agent/pull/133182), [#136417](https://github.com/NousResearch/hermes-agent/pull/136417), [#135504](https://github.com/NousResearch/hermes-agent/pull/135504), [#120912](https://github.com/NousResearch/hermes-agent/pull/120912), [#120922](https://github.com/NousResearch/hermes-agent/pull/120922) — @tobenwarrior)
- **Updates you can steer** — Source installs pick Stable or Every commit in Settings › About; the updates dialog names the channel. The app warns when older than its backend. ([#135949](https://github.com/NousResearch/hermes-agent/pull/135949), [#136313](https://github.com/NousResearch/hermes-agent/pull/136313), [#122911](https://github.com/NousResearch/hermes-agent/pull/122911) — @OutThisLife)
- **App polish** — "While working" keep-awake mode, macOS 26 layered icon, sharper MSIX icons, opt-in shared-metrics consent strip. ([#128984](https://github.com/NousResearch/hermes-agent/pull/128984), [#122976](https://github.com/NousResearch/hermes-agent/pull/122976), [#131669](https://github.com/NousResearch/hermes-agent/pull/131669), [#125074](https://github.com/NousResearch/hermes-agent/pull/125074) — @kshitijk4poor, @jonpol01, @ethernet8023)

## ⌨️ CLI, TUI & Dashboard

### CLI
- **Vim keys, git branch and bell** — `display.vim_mode`, `git_branch` status field, `display.bell_on_prompt` (bell plus OSC 9 notification); all off by default. ([#106412](https://github.com/NousResearch/hermes-agent/pull/106412), [#106434](https://github.com/NousResearch/hermes-agent/pull/106434), [#101284](https://github.com/NousResearch/hermes-agent/pull/101284), [#101320](https://github.com/NousResearch/hermes-agent/pull/101320) — @saforem2, @TurgutKural, @glitchbunny0, @harshmoney123)
- **Friendlier keys** — Ctrl+T opens the subagent monitor; a mid-turn multi-line paste is one message. ([#105879](https://github.com/NousResearch/hermes-agent/pull/105879), [#109146](https://github.com/NousResearch/hermes-agent/pull/109146))
- **Scriptable commands** — `hermes usage --json` (quota, no session); `hermes worktree --json/--older-than`; `kanban edit --title/--body/--priority`; `-t` picks MCP servers to start. ([#115899](https://github.com/NousResearch/hermes-agent/pull/115899), [#95257](https://github.com/NousResearch/hermes-agent/pull/95257), [#117632](https://github.com/NousResearch/hermes-agent/pull/117632), [#101634](https://github.com/NousResearch/hermes-agent/pull/101634) — @himanusia, @kshitijk4poor, @SelfParody)
- **Also** — `hermes -z` exits non-zero on failure; `-m custom:<name>:<model>` reaches that provider; the footer no longer collapses to "Window too small". ([#113234](https://github.com/NousResearch/hermes-agent/pull/113234), [#115293](https://github.com/NousResearch/hermes-agent/pull/115293), [#117439](https://github.com/NousResearch/hermes-agent/pull/117439) — @kshitijk4poor)
### TUI
- **Native terminal mode** — `--native` or `display.tui_native` (opt-in). ([#121035](https://github.com/NousResearch/hermes-agent/pull/121035) — @OutThisLife)
- **Running-turn control** — double-Esc interrupts, push-to-talk cuts speech, the live dock (CLI too) shows `/goal` and queued prompts. ([#125803](https://github.com/NousResearch/hermes-agent/pull/125803) — @OutThisLife)
- **Typing fixes** — Shift+letter on extended-key terminals, macOS Ctrl+D, Wayland image paste, steady idle redraws. ([#90674](https://github.com/NousResearch/hermes-agent/pull/90674), [#116851](https://github.com/NousResearch/hermes-agent/pull/116851), [#116824](https://github.com/NousResearch/hermes-agent/pull/116824), [#87907](https://github.com/NousResearch/hermes-agent/pull/87907) — @francip, @fangliquanflq)
- **Reconnects and attachments** — attached TUIs rejoin their session; `attachments.storage: workspace` stages files a sandboxed agent can read. ([#112227](https://github.com/NousResearch/hermes-agent/pull/112227), [#125816](https://github.com/NousResearch/hermes-agent/pull/125816) — @OutThisLife)
### Dashboard
- **Chat on more devices** — screen readers, iPad touch-scroll, no doubled mobile-keyboard characters; a second tab gets its own terminal. ([#133960](https://github.com/NousResearch/hermes-agent/pull/133960), [#134181](https://github.com/NousResearch/hermes-agent/pull/134181), [#116978](https://github.com/NousResearch/hermes-agent/pull/116978), [#117061](https://github.com/NousResearch/hermes-agent/pull/117061) — @austinpickett)
- **Errors, sessions, analytics** — errors are a sentence and fix button, not raw JSON; title search, a live switcher, per-API-call analytics. ([#111602](https://github.com/NousResearch/hermes-agent/pull/111602), [#133981](https://github.com/NousResearch/hermes-agent/pull/133981), [#134100](https://github.com/NousResearch/hermes-agent/pull/134100), [#133991](https://github.com/NousResearch/hermes-agent/pull/133991) — @austinpickett)
- **Self-hosting** — reverse-proxy subpaths, password sign-in beside OAuth, non-expiring remote sessions. ([#133903](https://github.com/NousResearch/hermes-agent/pull/133903), [#107018](https://github.com/NousResearch/hermes-agent/pull/107018), [#110061](https://github.com/NousResearch/hermes-agent/pull/110061) — @austinpickett, @Doud-FR)
### Slash commands
- **Reasoning effort in every picker** — `hermes model`, aux models and `/model` add an effort step; `/model X --reasoning high` works too. ([#110346](https://github.com/NousResearch/hermes-agent/pull/110346))
- **Editable `/queue`** — list, edit, move or remove prompts; `/s` = `/steer`. ([#95999](https://github.com/NousResearch/hermes-agent/pull/95999), [#125803](https://github.com/NousResearch/hermes-agent/pull/125803) — @abhinav11082001-stack, @OutThisLife)
- **`/context` per file** — shows each instruction file as loaded, truncated or shadowed. ([#91272](https://github.com/NousResearch/hermes-agent/pull/91272))

## 🔧 Tools, MCP & Browser

### Tools & tool search
- **Rare tools load on demand** — computer_use, session_search, image_generate, cron and Desktop GUI tools sit behind `tool_search` by default (desktop schemas 13,367→6,883 tokens; `defer: []` opts out); `todo`/`cronjob`/`process` become `todo_list`/`cronjob_manage`/`process_manage` (aliases kept). ([#97979](https://github.com/NousResearch/hermes-agent/pull/97979) — @alt-glitch)
- **Prompt cache holds all session** — the tool list is frozen per session across TUI, `-q --resume` and gateway hops. ([#120289](https://github.com/NousResearch/hermes-agent/pull/120289))
- **Loop guardrails** — unattended gateway/cron sessions hard-stop tool loops; 5 identical replays halt any tool. ([#100967](https://github.com/NousResearch/hermes-agent/pull/100967) — @plcunha, @benbenlijie)
- **Smarter file and web tools** — `read_file` shows SQLite schemas and flags merge conflicts, `search_files` runs ripgrep directly (5–6x faster), keyless `web_search` fails over between free vendors. ([#115974](https://github.com/NousResearch/hermes-agent/pull/115974), [#104502](https://github.com/NousResearch/hermes-agent/pull/104502), [#134048](https://github.com/NousResearch/hermes-agent/pull/134048) — @kshitijk4poor, @alt-glitch)
### MCP
- **Device-code login** — `hermes mcp login <server> --flow device` for headless terminals. ([#104891](https://github.com/NousResearch/hermes-agent/pull/104891) — @wjorgensen)
- **Sturdier OAuth** — refresh tokens are never erased, double-spent or sent to another issuer; RFC 9207, Google-hosted and WAF-fronted servers log in; gateways never open browser tabs. ([#106185](https://github.com/NousResearch/hermes-agent/pull/106185), [#111186](https://github.com/NousResearch/hermes-agent/pull/111186) — @kshitijk4poor, @anhtahaylove)
- **More servers connect** — SSE-only servers fall back, strict servers connect (`sampling.tools` opt-in), and the catalog adds official n8n and Asana V2. ([#106432](https://github.com/NousResearch/hermes-agent/pull/106432), [#131891](https://github.com/NousResearch/hermes-agent/pull/131891), [#116048](https://github.com/NousResearch/hermes-agent/pull/116048) — @aieng-abdullah, @OutThisLife, @nikkoxgonzales, @alt-glitch)
- **Startup and results** — boot connects ≤ `mcp.discovery_concurrency` (4) servers at once; vision models see MCP images; dead stdio servers respawn without replaying a call. ([#117956](https://github.com/NousResearch/hermes-agent/pull/117956), [#133815](https://github.com/NousResearch/hermes-agent/pull/133815), [#106546](https://github.com/NousResearch/hermes-agent/pull/106546) — @Halldrix, @sarahwu185, @100yenadmin)
### Browser & computer use
- **Vault and sandboxed screen** — password-manager sign-in also fills cards and addresses after you confirm; `hermes-sandbox:desktop` is the new default image (existing sandboxes kept). ([#106480](https://github.com/NousResearch/hermes-agent/pull/106480), [#121169](https://github.com/NousResearch/hermes-agent/pull/121169))
- **`browser_exec` works out of the box** — drives bundled Chromium (also the cloud fallback) and opens localhost via a sidecar. ([#102986](https://github.com/NousResearch/hermes-agent/pull/102986) — @shadus)
- Also: a CDP seam for plugins; unchanged `computer_use` screens are not resent. ([#133552](https://github.com/NousResearch/hermes-agent/pull/133552), [#98954](https://github.com/NousResearch/hermes-agent/pull/98954) — @web3blind)
### Terminal & code execution
- **Long commands stop blocking** — foreground timeouts over 600 s become background jobs, `heartbeat=N` sends progress, and the live-work dock lists them. ([#103529](https://github.com/NousResearch/hermes-agent/pull/103529))
- **Sandboxes** — results flag a recreated environment; SSH paths resolve remotely. ([#107093](https://github.com/NousResearch/hermes-agent/pull/107093), [#122657](https://github.com/NousResearch/hermes-agent/pull/122657) — @kshitijk4poor, @xxxigm)
- **LSP** — custom servers via `lsp.servers` and `lsp.package_manager`; never runs a cloned repo's own interpreter or SDK. ([#115714](https://github.com/NousResearch/hermes-agent/pull/115714), [#126239](https://github.com/NousResearch/hermes-agent/pull/126239) — @ZHCHJ888, @kshitijk4poor, @jonpol01)
### Media (image/video/voice)
- **New models** — GPT Image 2.5, Kling Image v3; video: Kling 3.0, Kling O3, LTX 2.5, Wan 3.0, MiniMax H3 Max Turbo, Gemini Omni Flash 1.1. ([#105988](https://github.com/NousResearch/hermes-agent/pull/105988))
- **Live dictation** — opt-in `stt.streaming` shows words as you speak (CLI, TUI, Desktop); long recordings transcribe on all cloud providers. ([#133853](https://github.com/NousResearch/hermes-agent/pull/133853), [#133825](https://github.com/NousResearch/hermes-agent/pull/133825) — @TimeLord2010, @Julientalbot, @kokhlo)
- **Voice conversations** — opt-in `voice.voice_chat_mode: gpt-live` gives Desktop full-duplex voice; `auxiliary.voice_chat` runs spoken turns on a faster model; TTS starts sooner. ([#108137](https://github.com/NousResearch/hermes-agent/pull/108137), [#133986](https://github.com/NousResearch/hermes-agent/pull/133986), [#115846](https://github.com/NousResearch/hermes-agent/pull/115846) — @liuhao1024)

## 🧩 Plugins, Skills & the Plugin Catalog

### Plugin Catalog
- **Plugin and author pages** — [/docs/plugins](https://hermes-agent.nousresearch.com/docs/plugins) shelves plugins under Memory, Desktop, Platforms, Web, Tools, Voice, Automation and Models. Pages show the description, a disclosure callout, screenshots, the README from the pinned commit, an Open in Hermes Desktop button and a copyable install command. ([#111415](https://github.com/NousResearch/hermes-agent/pull/111415), [#111547](https://github.com/NousResearch/hermes-agent/pull/111547), [#117808](https://github.com/NousResearch/hermes-agent/pull/117808))
- **Easier-to-read cards** — a version label sits next to the pinned commit (`1.2.0 @ ad3f352b`) on the website, CLI and Desktop; cards gained banner images, a uniform size and light mode. ([#113381](https://github.com/NousResearch/hermes-agent/pull/113381), [#125065](https://github.com/NousResearch/hermes-agent/pull/125065), [#124001](https://github.com/NousResearch/hermes-agent/pull/124001) — @kshitijk4poor, @xxxigm)
- **Known-issue warnings** — listings can declare known issues, which `hermes plugins install` and the dashboard show on install. ([#124058](https://github.com/NousResearch/hermes-agent/pull/124058) — @happy5318)
- **Listing rules** — Desktop plugins must stay within SDK slots, 11 plugins that patched internals were delisted (installed copies keep working), and the submission guide matches what CI enforces. ([#115579](https://github.com/NousResearch/hermes-agent/pull/115579), [#130860](https://github.com/NousResearch/hermes-agent/pull/130860), [#131048](https://github.com/NousResearch/hermes-agent/pull/131048))

### New in the Catalog
All 600 listings are new this cycle.
- **Moved out of core** — besides the five memory providers, Holographic has a new community maintainer; Home Assistant, Spotify, Langfuse and TouchDesigner are now official catalog plugins. ([#114732](https://github.com/NousResearch/hermes-agent/pull/114732), [#136196](https://github.com/NousResearch/hermes-agent/pull/136196), [#132476](https://github.com/NousResearch/hermes-agent/pull/132476), [#137130](https://github.com/NousResearch/hermes-agent/pull/137130) — @itpartypattaya)
- **Official** — Blender Lab, Snyk, NVIDIA App and NVIDIA Broadcast (Windows only), Telegram Business, Memory Wiki. ([#119365](https://github.com/NousResearch/hermes-agent/pull/119365), [#109084](https://github.com/NousResearch/hermes-agent/pull/109084) — @alt-glitch)
- **Memory (65)** — Cognee, LanceDB, ReMe, Memoria, HydraDB, Mnemosyne, YantrikDB, BetterDB. **Web and search (34)** — Apify, Parallel, Linkup, SerpApi, You.com, TinyFish, Oxylabs. **Model providers (48)** — JetBrains Junie, Telnyx, NetMind, Groq, Chutes, Kiro, Opper, AIHubMix. **Platforms (32)** — Inline, Microsoft 365, Rocket.Chat, VK, Zalo, iMessage, Sendblue. **Voice (18)** — Speechify, Deepgram, Fish Audio, Gemini Live. **Desktop panes (140)** — Telegram Client, Quota, Orbit, Kanban Gantt, Monitoring Dashboard. **Tools (180)** — GitHub App, Coder, Devin, NetBox, Financial Datasets, MetaMask, Tempo MPP, DaVinci Resolve, vidIQ, Govee, SwitchBot, Japanese e-Gov data. ([#112292](https://github.com/NousResearch/hermes-agent/pull/112292), [#118231](https://github.com/NousResearch/hermes-agent/pull/118231), [#118512](https://github.com/NousResearch/hermes-agent/pull/118512), [#114202](https://github.com/NousResearch/hermes-agent/pull/114202) — @siillee, @georgeatparallel, @AlexanderPrendota and many more)

### Plugin system
- **Model providers as plugins** — out-of-tree providers show in model pickers, log in via `hermes auth` (built-in OAuth PKCE) and refresh tokens. ([#116552](https://github.com/NousResearch/hermes-agent/pull/116552) — @ericmaddox, @ZenMux-1)
- **Per-profile plugin host (opt-in)** — `plugins.isolation: host` runs third-party plugins in a per-profile process with only that profile's secrets. ([#126911](https://github.com/NousResearch/hermes-agent/pull/126911))
- **New plugin APIs** — hooks for interrupted turns, auxiliary LLM calls and human-input prompts; plugins can start gateway sessions, add Automation Blueprints and aux model slots, ship the computer-use driver and make Codex-signed requests. ([#118909](https://github.com/NousResearch/hermes-agent/pull/118909) — @zrmnelson, @JonZal, @hsy5571615, @webtecnica)
- **Desktop plugin SDK** — `config_schema` settings render as a form in Capabilities → Plugins; plugins get a skills/toolsets/profiles bridge and model-pill/menu slots. ([#118917](https://github.com/NousResearch/hermes-agent/pull/118917) — @LeonSGP43, @tobenwarrior)
- **Install, pin, update** — private repos install with your git credentials, Desktop pins a plugin to a commit, updates keep user data, and plugin skills run as `/plugin:skill`. ([#106981](https://github.com/NousResearch/hermes-agent/pull/106981), [#107321](https://github.com/NousResearch/hermes-agent/pull/107321), [#133175](https://github.com/NousResearch/hermes-agent/pull/133175) — @JoaoMarcos44, @pnpwin, @ctaylor86)
- **Sturdier loader and scanner** — hung imports are skipped after `plugins.load_timeout_seconds` (10s), guard hooks fail closed, and prose, fixtures and regex literals no longer block installs; plugin deps follow the plugin's security policy. ([#118915](https://github.com/NousResearch/hermes-agent/pull/118915), [#115954](https://github.com/NousResearch/hermes-agent/pull/115954))
- **Moved out of core** — Spotify and Langfuse became official plugins (auto-migrated); tirith was removed, its key checks built in. ([#135389](https://github.com/NousResearch/hermes-agent/pull/135389), [#133832](https://github.com/NousResearch/hermes-agent/pull/133832))
- **New plugins** — reMarkable, hermes-pii, hermes-stt-enhance (catalog); Meta muse-image (bundled). ([#117191](https://github.com/NousResearch/hermes-agent/pull/117191), [#132154](https://github.com/NousResearch/hermes-agent/pull/132154), [#134418](https://github.com/NousResearch/hermes-agent/pull/134418), [#100959](https://github.com/NousResearch/hermes-agent/pull/100959) — @cygnostik, @lukefx, @dmmeteo, @mreso)

### Skills
- **New optional skills** — pr-lens (animated PR diagrams), system-atlas, anatomy (isometric explainers), mono-color (ink-print images), dream-loop (3D concept-art loops), scrollcraft (scroll pages), auteur (cinematic web), ip-as-logo (mascots), ai-presenter-video, live-dashboard (self-updating pages), dynamic-workflow (fan-out campaigns), reddit-reading, rss-feeds. ([#109306](https://github.com/NousResearch/hermes-agent/pull/109306), [#103821](https://github.com/NousResearch/hermes-agent/pull/103821))
- **Skills Hub** — the index builds again with about 480 science skills; search also finds unindexed skills. ([#109178](https://github.com/NousResearch/hermes-agent/pull/109178))
- **`skills.auto_load` and `skills.create_dir`** — pin skills into every session; choose where agent-made skills go. ([#92048](https://github.com/NousResearch/hermes-agent/pull/92048), [#100377](https://github.com/NousResearch/hermes-agent/pull/100377) — @ctaylor86, @ArcherQAQ, @giwaov, @Frosti7)
- **Better self-improvement** — learnings and corrections go into the task's skill; background review can improve any skill; skills added mid-chat reach the next message. ([#102107](https://github.com/NousResearch/hermes-agent/pull/102107))
- **Lighter curator** — no longer blocks the CLI prompt; one install fell from 1.9 GB to about 200 MB; unused skills archive at 30 days (was 90). ([#115862](https://github.com/NousResearch/hermes-agent/pull/115862))
- **Skills Guard** — blocked installs in a 421-skill sample fell from 83 to 68; inline shell is limited to non-community skills. ([#135595](https://github.com/NousResearch/hermes-agent/pull/135595) — @Awshesh12, @liuhao1024, @FlashWayne)

## ⏰ Cron, Kanban & Delegation

### Cron
- **Jobs follow your main model** — Unpinned jobs use the model configured at fire time; `pinned` locks one. ([#113679](https://github.com/NousResearch/hermes-agent/pull/113679))
- **Self-healing schedules** — A fire that never reached the model (e.g. after wake) re-runs after 5, 15 and 30 minutes, a provider "retry after" window parks the job quietly, and a slot missed during a restart fires once. ([#108731](https://github.com/NousResearch/hermes-agent/pull/108731), [#115843](https://github.com/NousResearch/hermes-agent/pull/115843))
- **Quieter alerts** — One alert per incident plus a reminder every `cron.failure_repeat_alert_hours`; `failure_deliver` reroutes or mutes failure notices; an agent can fail its run with `[CRON_FAILURE]`. ([#114807](https://github.com/NousResearch/hermes-agent/pull/114807), [#101373](https://github.com/NousResearch/hermes-agent/pull/101373), [#113155](https://github.com/NousResearch/hermes-agent/pull/113155)) — @victor-kyriazakos
- **New job options** — `--paused` creates a job unarmed; `--interpreter` runs scripts on your own venv. ([#104984](https://github.com/NousResearch/hermes-agent/pull/104984), [#125392](https://github.com/NousResearch/hermes-agent/pull/125392)) — @M1racleShih
- **Profiles and delivery** — A multiplexed gateway runs each profile's jobs with that profile's env and secrets; delivery needs positive evidence, output is secret-redacted everywhere, and late or satellite runs are labelled. ([#118027](https://github.com/NousResearch/hermes-agent/pull/118027), [#100908](https://github.com/NousResearch/hermes-agent/pull/100908), [#112830](https://github.com/NousResearch/hermes-agent/pull/112830)) — @yoniebans

### Kanban
- **Workers ride out provider trouble** — Failed turns retry in place with context; rate limits or 5xx requeue instead of burning retries. ([#112318](https://github.com/NousResearch/hermes-agent/pull/112318), [#112500](https://github.com/NousResearch/hermes-agent/pull/112500)) — @EvgenyMettsler, @dmelkk-secondbrain
- **A board that explains itself** — Cards show the worker's last output on failure; dispatch says why a card is held. ([#112618](https://github.com/NousResearch/hermes-agent/pull/112618)) — @chelsealong
- **Workflow and tooling** — One workflow definition drives columns; workers get `kanban_schedule`; `kanban create --body-file`; Desktop follows gateway switches. ([#134340](https://github.com/NousResearch/hermes-agent/pull/134340), [#130455](https://github.com/NousResearch/hermes-agent/pull/130455), [#116791](https://github.com/NousResearch/hermes-agent/pull/116791), [#119054](https://github.com/NousResearch/hermes-agent/pull/119054)) — @benbarclay, @unsupportedpastels, @fangliquanflq

### Delegation & multi-agent
- **Live subagents, images and /stop** *(see Highlights)*. ([#105593](https://github.com/NousResearch/hermes-agent/pull/105593))
- **Fan-outs lose less** — Failed children surface at once, an owner crash keeps finished work, children can hand processes to the parent, and per-task completions are opt-in. ([#103549](https://github.com/NousResearch/hermes-agent/pull/103549), [#116707](https://github.com/NousResearch/hermes-agent/pull/116707), [#105125](https://github.com/NousResearch/hermes-agent/pull/105125))
- **Child routing** — `delegation.fallback_providers` gives children their own chain; `child_timeout_seconds` measures inactivity. ([#105347](https://github.com/NousResearch/hermes-agent/pull/105347), [#117606](https://github.com/NousResearch/hermes-agent/pull/117606)) — @ayushnangia
- **/goal** — Consistent on CLI, Desktop and messaging; the judge waits on subagents; `/goal pause for now` no longer overwrites the goal; gates run in the session workspace. ([#104833](https://github.com/NousResearch/hermes-agent/pull/104833), [#132251](https://github.com/NousResearch/hermes-agent/pull/132251), [#125453](https://github.com/NousResearch/hermes-agent/pull/125453)) — @jayzhou2309

## 🔒 Security, Privacy & Codebase

### Security & privacy
- **v0.21.6 security fixes** — dashboard sign-in hardening (spoofed `X-Forwarded-For`, size caps, loopback-only login codes); automatic git skips repo filter programs; the email allowlist resists display-name spoofing. ([#133367](https://github.com/NousResearch/hermes-agent/pull/133367), [#130685](https://github.com/NousResearch/hermes-agent/pull/130685), [#130661](https://github.com/NousResearch/hermes-agent/pull/130661), [#125212](https://github.com/NousResearch/hermes-agent/pull/125212)) — @unsupportedpastels, @kshitijk4poor, @Froraut, @jonpol01, @keeltrace
- **Secrets stay put** — child processes don't inherit adapter/dashboard secrets; remote `execute_code` keeps its token out of argv; profile exports skip credential stores; keys never reach foreign hosts on refresh/fallback. ([#125755](https://github.com/NousResearch/hermes-agent/pull/125755), [#124262](https://github.com/NousResearch/hermes-agent/pull/124262), [#130525](https://github.com/NousResearch/hermes-agent/pull/130525), [#120299](https://github.com/NousResearch/hermes-agent/pull/120299)) — @kshitijk4poor, @jonpol01, @beardthelion, @leemove
- **Sharper redaction** — debug share redacts before truncating; file reads and terminal output mask `.env`/config secrets; `hermes config get` masks unless `--raw`; memory hand-offs are scrubbed; plain `token=` lines stay visible. ([#132270](https://github.com/NousResearch/hermes-agent/pull/132270), [#111422](https://github.com/NousResearch/hermes-agent/pull/111422), [#111341](https://github.com/NousResearch/hermes-agent/pull/111341), [#134429](https://github.com/NousResearch/hermes-agent/pull/134429), [#100564](https://github.com/NousResearch/hermes-agent/pull/100564)) — @kshitijk4poor, @Froraut, @shehjaddev, @webtecnica, @aniruddhaadak80, @fangliquanflq
- **Owner-only files at rest** — credentials, `state.db`, snapshots, browser profiles, media caches, any umask. ([#109509](https://github.com/NousResearch/hermes-agent/pull/109509), [#127229](https://github.com/NousResearch/hermes-agent/pull/127229)) — @JoaoMarcos44, @rohitsabu, @OutThisLife
- **Wider guards** — more fetches pass the SSRF guard (`security.fake_ip_ranges` for fake-ip proxies); cloud-metadata fetches, zsh/dash pipe-to-shell and `deno eval` need approval; `approvals.deny` works in sandboxes; built-in rules replace bundled tirith. ([#114887](https://github.com/NousResearch/hermes-agent/pull/114887), [#113156](https://github.com/NousResearch/hermes-agent/pull/113156), [#116726](https://github.com/NousResearch/hermes-agent/pull/116726), [#103649](https://github.com/NousResearch/hermes-agent/pull/103649), [#133832](https://github.com/NousResearch/hermes-agent/pull/133832)) — @beardthelion, @AYin-Z, @fangliquanflq
- **Holes closed** — the MCP OAuth callback stops reflecting HTML; webhook, SMS and WhatsApp Cloud inbound reject blank signing secrets. ([#92612](https://github.com/NousResearch/hermes-agent/pull/92612), [#133257](https://github.com/NousResearch/hermes-agent/pull/133257)) — @memosr, @ahadvice
- **Opt-in shared metrics** — daily usage stats reach Nous only with consent; both `telemetry.shared_metrics` switches default off, each profile asks once, Enter = "No thanks". ([#95278](https://github.com/NousResearch/hermes-agent/pull/95278)) — @benbarclay
### Codebase & performance
- **Leaner prompts and tools** — ~2.1k fewer prompt tokens a request, on-demand vault tools, one-round-trip file probes, `hermes -w` no longer repacks each launch. ([#137084](https://github.com/NousResearch/hermes-agent/pull/137084), [#101599](https://github.com/NousResearch/hermes-agent/pull/101599)) — @yaojiejia
### Other
- **Safer backups** — `hermes backup` keeps the newest 3, flags incomplete archives; `hermes import` refuses damaged ones. ([#106455](https://github.com/NousResearch/hermes-agent/pull/106455), [#121498](https://github.com/NousResearch/hermes-agent/pull/121498)) — @buihongduc132, @kshitijk4poor
- **Also** — `KEY_2`… env vars join credential pools; one-screen `hermes status`; opt-in `display.suppress_warning_notifications`; Desktop Bots roster sections; only Hermes' own node/npm/uv are used; Xiaomi MiMo v2.6. ([#112390](https://github.com/NousResearch/hermes-agent/pull/112390), [#131034](https://github.com/NousResearch/hermes-agent/pull/131034), [#114370](https://github.com/NousResearch/hermes-agent/pull/114370), [#101290](https://github.com/NousResearch/hermes-agent/pull/101290), [#125589](https://github.com/NousResearch/hermes-agent/pull/125589), [#118502](https://github.com/NousResearch/hermes-agent/pull/118502)) — @PhoeniXAbhisheK, @victor-kyriazakos, @fortun8te, @rob-maron
- **For contributors** — CODEOWNERS replaces the label gate; E2E (incl. native Windows) runs only on release builds; stable releases skip macOS Intel/Termux by default. ([#131726](https://github.com/NousResearch/hermes-agent/pull/131726), [#136603](https://github.com/NousResearch/hermes-agent/pull/136603)) — @ethernet8023

## 🐛 Notable Bug Fixes

**Onboarding, connectors & local models**
- Managed llama-server no longer crashes on Windows with 0xC0000374 and no longer inherits your credentials ([#116923](https://github.com/NousResearch/hermes-agent/pull/116923))
- Windows local-model servers are contained and orphans recovered safely; two backends booting together start one router ([#111038](https://github.com/NousResearch/hermes-agent/pull/111038), [#117600](https://github.com/NousResearch/hermes-agent/pull/117600) — @jquesnelle, @chelsealong)

**Install, update & packaging**
- Docker agents no longer lose their built-in API server, messaging and MCP dependencies after a restart. ([#135726](https://github.com/NousResearch/hermes-agent/pull/135726) — @unsupportedpastels)
- A `hermes update` killed mid-pull no longer breaks every entry point. ([#120339](https://github.com/NousResearch/hermes-agent/pull/120339))

**Providers & models**
- A rate-limited Claude model no longer benches the whole credential for every other Claude model. ([#113171](https://github.com/NousResearch/hermes-agent/pull/113171) — @KoNit-K)
- Codex app-server sessions now get SOUL.md and the Hermes system prompt. ([#115759](https://github.com/NousResearch/hermes-agent/pull/115759) — @JonthanaHanh, @ooiuuii, @Momentum96)

**Agent loop, sessions & memory**
- A chat whose session row was deleted recreates it instead of silently dropping every later turn ([#124117](https://github.com/NousResearch/hermes-agent/pull/124117) — @kshitijk4poor, @strzhao)
- Messages flushed at gateway shutdown are recovered into their session ([#114225](https://github.com/NousResearch/hermes-agent/pull/114225) — @kshitijk4poor, @spfcraze, @yoyodine-industries, @briandevans)

**Gateway & platforms**
- Telegram no longer stalls under flood control or stays connected but deaf on a wedged dispatcher. ([#116987](https://github.com/NousResearch/hermes-agent/pull/116987), [#132162](https://github.com/NousResearch/hermes-agent/pull/132162) — @kshitijk4poor)
- Slack native streaming stops posting answers twice. ([#121762](https://github.com/NousResearch/hermes-agent/pull/121762) — @kshitijk4poor, @ms-elbdev)

**Desktop**
- Replies no longer show twice, garble or vanish after resume, steer, a chat switch or reconnect ([#118890](https://github.com/NousResearch/hermes-agent/pull/118890), [#120290](https://github.com/NousResearch/hermes-agent/pull/120290), [#121061](https://github.com/NousResearch/hermes-agent/pull/121061) — @BearHuddleston)
- Pressing Enter answers the clarify card on screen, not a background chat's ([#76472](https://github.com/NousResearch/hermes-agent/pull/76472) — @briandevans)
- Duplicate or vanishing replies after refresh, session switch or reused tool-call ids ([#131758](https://github.com/NousResearch/hermes-agent/pull/131758), [#128003](https://github.com/NousResearch/hermes-agent/pull/128003), [#130553](https://github.com/NousResearch/hermes-agent/pull/130553) — @OutThisLife, @alt-glitch, @kshitijk4poor)
- "This device" backends no longer idle-killed after an hour; new chats run on the gateway you picked ([#134942](https://github.com/NousResearch/hermes-agent/pull/134942), [#132538](https://github.com/NousResearch/hermes-agent/pull/132538) — @unsupportedpastels)

**CLI, TUI & dashboard**
- Dashboard saves no longer overwrite secrets with their masked preview ([#121250](https://github.com/NousResearch/hermes-agent/pull/121250) — @kshitijk4poor)
- Resizing the CLI no longer re-appends the conversation to scrollback ([#120321](https://github.com/NousResearch/hermes-agent/pull/120321) — @Jackal991)

**Tools, MCP & browser**
- A parked OAuth MCP server no longer replays its dead refresh token on every new session, a storm that could trip a rate-limit ban ([#137502](https://github.com/NousResearch/hermes-agent/pull/137502)).
- `computer_use` element clicks work again on cua-driver 0.21+; only pixel clicks worked before ([#111313](https://github.com/NousResearch/hermes-agent/pull/111313) — @jeffjhunter).

**Plugins & skills**
- `hermes plugins list` and the dashboard Plugins page make at most one live catalog request instead of waiting through one timeout per installed plugin. ([#114811](https://github.com/NousResearch/hermes-agent/pull/114811))
- On treeless source checkouts the plugin inventory no longer takes 40–80 seconds, which was longer than the Desktop request timeout. ([#125716](https://github.com/NousResearch/hermes-agent/pull/125716) — @liuhao1024)
- Enabling a plugin from Desktop, the TUI or the dashboard no longer strips the core tools. ([#135048](https://github.com/NousResearch/hermes-agent/pull/135048))
- A platform whose plugin failed to load at startup is flagged in `hermes status` and comes back without a restart. ([#130613](https://github.com/NousResearch/hermes-agent/pull/130613), [#133289](https://github.com/NousResearch/hermes-agent/pull/133289)) — @kshitijk4poor

**Cron, Kanban & delegation**
- Gateway `/goal` gate add no longer lets a non-admin reach the host shell ([#101499](https://github.com/NousResearch/hermes-agent/pull/101499))
- Automatic git in Kanban, worktree cleanup and subagents no longer runs a cloned repo's hooks or filters ([#130661](https://github.com/NousResearch/hermes-agent/pull/130661))

**Security & misc**
- Qwen models behind Alibaba's content guardrail end the turn with the safety notice instead of retrying for four minutes. ([#136425](https://github.com/NousResearch/hermes-agent/pull/136425))
- Detected password managers can be switched on from Settings again; the toggle was a no-op. ([#109558](https://github.com/NousResearch/hermes-agent/pull/109558)) — @kokhlo

## ↩️ Reverted in this window (not shipping)

- **Collective Wisdom V1** (an in-tree org skill marketplace) was merged and then removed; there is no wisdom code in this release. ([#94266](https://github.com/NousResearch/hermes-agent/pull/94266) — @shannonsands)
- **The Desktop card-style Skills/Plugins catalog browser** and its website "Install in Hermes" links were reverted three times; Desktop browses capabilities as list tabs with the embedded catalog picker. ([#119381](https://github.com/NousResearch/hermes-agent/pull/119381), [#131252](https://github.com/NousResearch/hermes-agent/pull/131252))
- **Approval and clarify prompts that wait until answered** were reverted; `approvals.timeout` still applies. ([#130167](https://github.com/NousResearch/hermes-agent/pull/130167))
- **Parallel group-chat rounds** in Bot Mode were reverted; rooms run serially. ([#101112](https://github.com/NousResearch/hermes-agent/pull/101112), [#101139](https://github.com/NousResearch/hermes-agent/pull/101139))
- **Full isolation of named profiles from the root `auth.json`** was reverted after Desktop bots lost their shared login; profiles keep their own login when they have one. ([#113425](https://github.com/NousResearch/hermes-agent/pull/113425), [#118373](https://github.com/NousResearch/hermes-agent/pull/118373), [#134574](https://github.com/NousResearch/hermes-agent/pull/134574))
- **`hermes cron resnap`** and creation-time model snapshots were replaced by cron following your main model (`pinned` locks a job to one model). ([#106496](https://github.com/NousResearch/hermes-agent/pull/106496), [#113679](https://github.com/NousResearch/hermes-agent/pull/113679))
- **The Classic default skin palette** and **a tirith catalog plugin** were reverted. ([#130015](https://github.com/NousResearch/hermes-agent/pull/130015), [#133838](https://github.com/NousResearch/hermes-agent/pull/133838))

## 👥 Contributors

### Core Team (Nous Research)
- **@teknium1** — release direction, salvage campaigns across every subsystem, and ~2,800 merged PRs
- **@kshitijk4poor** (806 PRs) — providers and reasoning replay, compaction, state.db, free tier, multiplex parity, and hundreds of salvages
- **@OutThisLife** (679 PRs) — the desktop app: model picker, Settings ▸ Plugins, workspace, Bot Mode UI, connector cards
- **@alt-glitch** (175 PRs) — first-run onboarding, the Nous free tier, connectors, tool search, machine facts
- **@austinpickett** (160 PRs) — dashboard chat, desktop SSH/remote, Bot Mode and recovery fixes
- **@ethernet8023** (96 PRs) — the unified package manager, signed desktop bundles, stable release pipeline, local-model engines
- **@unsupportedpastels** (60 PRs) — CLI/TUI interrupt and admission handling, cron reliability, Discord voice, Docker extras
- **@jquesnelle** (22 PRs) — local models: the managed llama.cpp runtime, recommendations and engine pins
- **@helix4u** (20 PRs) — desktop interrupt, terminal and session fixes, installer ordering
- **@benbarclay**, **@victor-kyriazakos**, **@rewbs**, **@yoniebans**, **@rob-maron**, **@c2h5oh**, **@notwitcheer**, **@shannonsands** — relay and dashboard auth, Slack and Bedrock, managed search and connector tokens, install E2E, model catalogs, CI and linting, docs

### Top Community Contributors (by merged PR count)
- **@Adolanium** (44 PRs) — performance fixes, the in-app browser comment tool, session import, and a run of catalog plugins
- **@apoapostolov** (29), **@TakeshiTGAL** (22), **@100yenadmin** (19), **@olric3015** (18), **@aydnOktay** (12), **@cygnostik** (12), **@anpicasso** (12), **@itpartypattaya** (11), **@jacobhausler** (9) — the plugin catalog's biggest authors: reasoning and composer tools, Japanese government data, plan mode and boardstate, stream-speed and ledgers, desk tools, reMarkable and desktop realms, Kiro and approvals, hermes-dreaming and holographic, workflows and Beads
- **@Finn763** (14), **@liuhao1024** (13), **@xxxigm** (12), **@dskwe** (10), **@KoNit-K** (8), **@chelsealong** (8), **@686f6c61** (7) — desktop, Windows, SSH and Linux reliability, local-runtime memory pricing, Bot Screen paste, model catalog fixes
- **@jonpol01** (13 PRs) — compaction correctness and exact-bytes file patching

### All Contributors
Thank you to every one of the ~2,520 people who contributed code, co-authored fixes, or had their work salvaged into this release:

@0301chris @08085 @0bull @0disoft @0genlab @0x7s0lt1 @0xalydev @0xble @0xbyt4 @0xdany @0xDevNinja @0xGr1mm
@0xharryriddle @0xmosta @0xNyk @0xWhiteMage @0z1-ghb @100yenadmin @1052326311 @10ishq @122393594-ty @123456hyu
@123mikeyd @1960697431 @1RB @2025hcsmile2010-hue @29206394 @333Alden333 @33hodl @3DPrintPioneers @3L0935
@3ssiri @4adwentures @4dlt @52216165 @5uck1ess @686f6c61 @69k4xmdfm2-blip @6ylqq @895252509 @a-yeyang
@a1398394385 @a692570 @aadilghani1 @aaronlab @aashizpoudel @Abd0r @abderbj @abhibansal-sg @AbhijatSaxena
@Abnertheforeman @abualnassr @Abuarchiv @abundantbeing @acarsondave @acedatacloud-dev @acjsec @acsezen
@actualrat1984 @adamcap926 @adamking77 @adamkrawczyk @adammatski1972 @AdamPlatin123 @adanaleycio
@adarshdigievo @adavyas @addamsE @addelh @adecubed @adikpb @adleapnet @adolanium @AdrianBinDC @adriansotomora
@adurham @adybag14-cyber @aean0x @aeonsong @aerbaser @afifai @afourniernv @afurm @Agantila @agarg21
@agentdynamic @agentlinker @aglowinthefield @agt-user @ahadvice @ahamSel @ahisblessed @ahmed-3li @AhmetArif0
@Ahmett101 @ahrazzle @ahtishamdilawar @ai-ag2026 @AIalliAI @aieng-abdullah @aimable100 @Aio777 @airo7 @AJ
@ajaynomics @ajbmachon @ajensenwaud @ajspig @ajzrva-sys @ak2k @AKAZIK-py @akivavh @Akloenx123 @akshan-main
@akugone @Al3xand3r1987 @alaamohanad169-ship-it @AlanBurningsuit @alanfwilliams @alanwilhelm @albeight
@albert748 @albertodepaola @AlchemistChaos @aldoeliacim @aleesposito85 @alelpoan @alessandrolamberti
@alex-heritier @alex107ivanov @AlexanderBFoley @AlexanderPrendota @alexandreroumieu-codeapprentice
@AlexFucuson9 @AlexGabbia @alexgunsberg @AlexMnrs @AlexTu2 @alexwill87 @AlexxRussell @alfred-amanda
@alfred-smith-0 @aliasocracy @Alicorn-Max-S @aliilhami @alimbaydoun @alireza78a @alissongalindo
@AllenRobinHubert @alloevil @AlphaPerseii3000 @alrcatraz @AlsayedHoota @alt-glitch @AltenLi @alvarobiano
@alvarosanchez @am423 @aman-merchant @amanning3390 @amansk @ambition0802 @amekala @ameobius @amethystani
@AMIK-coorporations @amir-ag @amitcse @aml1973 @an420eth @anablancovicente @analista @anatolijlaptev1991-ctrl
@AndreasHiltner @andreausderhood @andrewhomeyer @andrewhosf @andrewkangkr @andrewmadson-pplx @AndrewMoryakov
@andrexibiza @Andy @andynguyendk @andyst-dev @andyylin @angel12 @angelos @anhtahaylove @aniruddhaadak80
@ankinow @AnnasMazhar @annguyenNous @anombyte93 @anoopmehendale-cue @anotherchu @anpicasso @anuiit
@anuvratrastogi @ap08960695 @AP3X-Dev @apexscaleai @apoapostolov @appletechie @aqilaziz @arasovic @arcabotai
@ArcanePivot @arceus77-7 @Archerouyang @ArcherQAQ @ArecaNon @ARegalado1 @Arguably1341 @arimu1 @arlai-mk
@armandokun @arminanton @aron-intframe @arrry-hydraDB @arrufat @ascetx @asdlem @asheriif @ashishpatel26
@ashmoonori-afk @AshuJoshi @asimons81 @askclaw-vesper @aslater3 @asorry75 @aspire488 @AsterJisu @astraltrekkin
@AStrnbrg @atbrace @atmaksri @atostivint @Atroci @ats3v @atul-trycoral @Aum08Desai @aurel282
@aurorabotticus-svg @auroracapital @austinlaw076 @austinpickett @Automata-intelligentsia @Avery @awizemann
@Awshesh12 @AxDSan @axiom-agent-ai @aydnOktay @AYin-Z @ayushmanpadhi @ayushnangia @AzurePii @B0on @b13kjack
@b2089766906-droid @baau @baauzi @babatorik @bablobanov @babyblueviper1 @back1992 @Backroads4Me @badiyee85
@badkangaroo @bakhtiersizhaev @baleian @banditburai @baofuen @Baophan00 @Bardioc1977 @barnicskolaci
@bartcollet @Bartok9 @basilnas @BatataBF @bayrakdarerdem @BB-light @bb873 @bbasketballer75 @bblicke1
@Beandon13 @bear0328 @beardthelion @BearHuddleston @bedirhancode @beibi9966 @Belaquaa @benawad @benbarclay
@benbenlijie @benegessarit @benjamin-rousseau-shift @benjaminbrumbaugh @BenKalsky @bennybuoy @bennyhodl
@bennytimz @benperry6 @beplee @Bergmann89 @bergusdz @berkantay @berthelius @bgrablin @BGwill-OUTLOOK @bheji07
@bighamx @BigKelLearns @Bihruze @bill3wits @binhnt92 @bionicbutterfly13 @Biotrioo @bird @bixycler @BkashJEE
@BlackishGreen33 @BlakeB254 @blakehermes9 @bloodcarter @BlueBirdBack @bluefateludi @bmcfiv @bmtrnavsky @bo.fu
@bobaba76 @bogerman1 @BonesGit @Bonorinoa @BoredSexyJordan @bounce12340 @BowmanStephen @bradestes @Brammiebram
@brantzh6 @bravohenry @brendanjryan @BrethofAI @brian717 @briancaffey @briandevans @BrianFranco @briepala
@BrierAinz @Brixyy @BROCCOLO1D @BrokeSkill @brucexu-eth @BrunoBza @bryanneva @bsdnn @btorresgil
@buddhaholic420 @buihongduc132 @BullishMomentum56 @bwoliveira @byjaps @byungsker @C-Est-Dept @c-pompa
@c0d1ngHUB @c0debyeric @c0mrade @c2h5oh @c3115644151 @ca-shrimp @cadezhou @Caelier @caentzminger @callsamik
@calvinnwq @cameronbergh @camilb @capthvnsen @carlosapgomes @carlotestor @carrion256 @Carry00 @caseyanthony
@catapreta @caya8205-2 @ccbbccbb @ccook1963 @cdanis @cdb-lumen @cdbartholomew @cdepuy @cdnsteve @ce-dric
@cedanoagent @certaindaniel @cervantesh @CES4751 @Cesar-Azeredo @cez0060405 @cg2aigc @chadhouser @Chadmc9889
@chaithanyak42 @ChanPark03 @charan-rathore @CharlesMcquade @Charlesmpc @CharlieKerfoot @CharZhou @ChasLui
@chelsealong @chenfeijiang95-ui @chengoak @chenhm @chenlichao @chenzeyan54-commits @cherrish333013 @cherryb16
@Chinmayrawat15 @chntllh @choaticpixels @Christopher-Schulze @christopherrobin88 @chrisworksai @chrisyoung2005
@chuenlye @chugiacan @chukirk-svg @Chukwuebuka-2003 @churnast @ciabata-git @CipherFrame @cipry0200 @CIRWEL
@cj52973 @Ckarey007 @ckomma @ckorhonen @clarkvines @claudioorjunior @claudiumio @claudlos @clayduncan
@ClintonEmok @Clippy @Cloeille @cloim @Clubheader @clyu168 @cmcejas @cmyyy @cnfi @cnkang @codebuff-team
@codeJRV @codeshipsingh @codexbt @Cody292 @Codyinked @coe0718 @cola-runner @CoLaOnline @ColdSlither @ColDSnit
@ColrWei @ComicBit @Commander @connns @Contentment003111 @convernaticspeter @Cortana @CortonKwok-GGD
@cosin2077 @Cossackx @cotghw @Cr4ckMe @CraigRichardsonRMPM @crazyief @crazywriter1 @crdesign8 @creeklava-svg
@cresslank @criptogus @cruzanstx @cruzlxyz @CryptoByz @CryptoDombili @cryptoyasenka @cspears32 @csreyes
@cswrld-net @ctaylor86 @cucurigoo @CupaJ12 @cuppett @cutepawss @cuuush @cuyua9 @cxxCoolStar @Cyber-Yichen
@cybertecla @cygnostik @cypres0099 @cyrkstudios @d31tcjg @d8joseph @Da7-Tech @daailouivan @dacheah @Dadmin88
@daedalus-opus @dafka007 @dagardner-nv @Dagulf795 @dajiaohuang @dalebetz @dalzio @DanBennettUK @dandacompany
@DaneelV3 @Danielmuzology @daniil-grois @danilofalcao @dankkush @danrudy33 @danspicytaco @dante32683 @daresan
@dariorapisardi @DarRahman @dasgltd @datanerdie @DatTheMaster @David-0x221Eight @david-bowiegxw @davidgut1982
@davidkarban @DavidMetcalfe @davidneyravyr @davidvv @davidxyuan @DaxLee9988 @dborodchuk @dborosev @dchenk
@deadczarvc @Deadtrix21 @deankerr @deas @deathxdefeat @DebadityaHait @Decent9967 @DECK6 @decofe @DECRUX9812
@deinte @delacaola @delltrak @deniqlab @DenisAraujo68 @denisqq @derekm @DeseretSaint @despotak @DESXIE
@DevAgarwal2 @devarticle @developersdigest @DevEverything01 @devorun @devsart95 @devseunggwan @DevvGwardo
@devwdave @Dezooyi @dgkaaks @dgpcboy @dhabibi @DhivinX @dhruv-kejriwal-mccain @Dhruv7201 @dhruvkej9 @Diaspar4u
@didida9527 @didodim @diegomarino @dieutx @diffen77 @Digitally-Challenged @dillweed @dimitrysuen @dirtyren
@djbclark @djennewe @djmango @djsanchezsuarez @djstunami @dkbjornn @dlcsouza @dlgrv @dlkakbs @dlshumway
@dmabry @dmahan93 @dmater01 @dmelkk-secondbrain @dmetcalfe @dmf01614-source @dmspark @dmyou @DoGMaTiiC
@DojoGenesis @Dolverin @domenicomassafra @DomGrieco @dominikamann @dominiquevidja @doncazper @dongxu0413
@doniocode @donovan-yohan @donramon77 @DonShelly @doojiang @doresa0 @doryani-ai @dot @Doud-FR @dparikh79
@dpersek @dpiers1 @dplush @DragonLi-Mi @DragonnZhang @draix @dreamfarer-space @DreamyMoonMouse @dredozubov
@DresvyanskiyDenis @drew-dot-com @drewTuzson @Drexuxux @drichar @drkpxl @dromai @dschnurbusch @dskwe
@dsr-restyn @Dusk1e @dusterbloom @duu261 @dwb1991 @dyiapanis @dynamite-bud @dzianisv @ea-s21 @Eapwrk
@eason2026 @easyvibecoding @eazye19 @echo931 @echohn @EdderTalmor @eddiewang @Edizzier @edosulai @edrethardo
@eduardo @EdwardIrby @efe-arv @Efistoffeles @egerev @egilewski @ehz0ah @eisene @Eji4h @ekkoitac @el-analista
@elashera @elbukott1 @eliasburlison @elisam0 @ellannjohnson @elmatadorgh @eloklam @eloktev @EloquentBrush0x
@elphamale @Elshayib @elvin-du @emadalsaba @eman062000 @EmanueleCornaggia @embwl0x @EmelyanenkoK @eminboydak
@eminogrande @emirsaffar-collab @emonty @emozilla @EmpireOperating @EMT5320 @Enchanted0911 @ennheng
@Enough1122 @entropidelic @entropy-0x @enwaiax @enzo-adami @eranbes @erenkarakus @erhnysr @eric-senyao
@ericmaddox @ErnestHysa @erosika @esketids @ether-btc @ethernet8023 @etrisnanto @euisuh @evan @evan-bradford
@EvanZhu0721 @eventh0riz0n @everm1nd @Everson-s8 @EvgenyMettsler @EvilDrag0n @EvilRan @Ex8-ca @ExitMaster
@Expri-commits @eyeonall @eynaudg @f3rs3n @F4TB0Yz @fabiantax @fabioaito @fabiomotta0311 @fabiosiqueira
@fahdad @faikwo @faisfamilytravel @FalconOrtiz @falkoro @fancyboi999 @fangliquanflq @FASTCHIP @fastfinge
@Fatmylin @fatwang2 @fazerluga-creator @fcarucci @fcavalcantirj @FeiyouG @felixdae @Felixkw12 @Feranmi10
@ferminquant @fernandezbaptiste @Fernandrewm @FestoneX @FEUAZUR @finn763 @firefly @FirmamentalSpring
@FlashWayne @FldBudin @flow-digital-ny @fluxkapacitor @flyer103 @flyingdoubleG @flyinhigh @fmercurio @foma
@foma-agent @foras910521-lab @forrestzhang107 @fortona-space @fortun8te @forumevi @forztf @fotedev @foxion37
@francip @franco314 @frankiethull @frankmendes1979 @fred0m @frendo @frizikk @frohsinnllc @Froraut @Frowtek
@frozen @fsaad1984 @ft-ioxcs @fujinice @FunJim @funkyotc @Futahua @g3org3yo @GabboAlarcon @gabbyong
@gabrielpaesland @gamewocao @Ganesh0690 @gaoanze888 @garadice @gas @Gateton @GauravPatil2515 @gauravsaxena1997
@gavasques @Gavin-Qiao @gbarany @gchablemeneses-web @geniok1980 @geoffreybutler94 @georgeatparallel
@georgejieh @gercamjr @gfriesen1 @ggascoigne @ggoldani @gh-dispatch @giggling-ginger @gilfoyle @girayk
@Git-on-my-level @gitabtion @gitcommit90 @GitmanIII @giwaov @gkd2323c @glasserai @glaw1300 @glesperance
@glitchbunny0 @globalvet2025 @gls774 @Glucksberg @gmoranxyz @gnanam1990 @gnanirahulnutakki @GoBeromsu
@godlin-gh @GodsBoy @Goitonthefloor @gokay-ai @gokhanyildirimlar @goku94123 @GoldenLoaf24h @gongyi
@gonzoblasco @googio @Gosuj @GottZ @gqwesleywang @Grey0202 @GrgaPalcic @Gridzilla @grimmjoww578 @grinco
@GroveMinting @gsy324 @GTHell @guanla-zz @GuardianZ71 @guberm @Guerilla-ops @gumclaw @gustavosmendes @gustbr
@gutslabs @gvago @h4ck200711 @haileymarshall @HaisamAbbas @haizaar @Halldrix @Han @hanamizuki @hansnow
@hanyu1212 @HanYunChenLuo @hanzckernel @happy5318 @hardwork9047 @hariNEzuMI928 @harjothkhara
@harrisonmedmedmetrics @harrylabsj @harryvgiunta @Harshkamdar67 @harshmoney123 @hassan-kamel @hassanhaidry
@haydster7 @hbizi @hcnimi @hdy2001 @HearthCore @heathley @hehehe0803 @hejuntt1014 @helingjun @helix4u
@HeLLGURD @hellofrommorgan @hellohanchen @hengm3467 @HenkDz @Henry-GGS @Hermes @Hermsi1337 @hernanda-git
@het0814 @HexLab98 @Heybinshao @HeyClos @heyf @heyhudson @hhhonzik @HiddenPuppy @higgs1729 @himanusia @Himess
@hinablue @Hinotoi-agent @Hiren @holny @HoneyTyagii @honor2030 @Hotragn @houko @hrnbld @hsy5571616 @hteo1337
@huangxun375-stack @huangyoje @huanshan5195 @hueilau @huklaa @HumphreySun98 @huntermonk @HwangJohn @Hygaard
@Hypn0sis @i-Hun @iacker @iainlane @iamagenius00 @iamfoz @iamlukethedev @iamwongeeeee @iap @IAvecilla
@ibhagwan @ibm2024 @iborazzi @ifastcc @ifrederico @igparkernz-coder @ikelvingo @ildunari @Imagineer99 @imgali
@Imgaojp @imgyf @imzacksong @InB4DevOps @inchargeautomation-lab @indigokarasu @indranilbanerjee
@infinitycrew39 @injaneity @insecurejezza @intelac @IntrepidBytes @ipriyaaanshu @IRONICBo @iRonin @irresi
@isaachuangGMICLOUD @isair @ishangodawatta @ishanparihar @ishardo @isheng-eqi @ishuowang @ismoilh
@isoenthusiast @israellot @IT-dreamer @italodsfernandes @itnkr @itpartypattaya @itsflownium @itskaism
@iveywest @Ivyleaguelawyer @izumi0uu @Izzy-Gottz @j-nolan @J0hnLawMississippi @Jaaneek @JabberELF @jacdevos
@Jack @Jackal991 @jackey8616 @JackHunzicker @jackjin1997 @JackLee992 @JackTheGit @jackulau @jacob3712
@jacobhausler @Jah-yee @jahazielhernandezbaubap @jahfaliabdulrahman-dev @Jaiminp007 @jakewvincent
@jakobbjelver @jakobdylanc @james47kjv @jangomango76 @JanHranicky @janviernine @jasm001 @jasonHav @jasonQin6
@jasonwu-ai @jatingodnani @jayzhou2309 @jbbottoms @jcjc81 @jcorrego @jcperdomoybarra @JE4NVRG
@jeeves-assistant @Jeffgithub0029 @jeffjhunter @jeffrobodie-glitch @jefuriiij @JeliTron @jerilynzheng
@jerrygooch @jerryhjones @JerryLiu369 @jervaise @jethac @jexbow @JezzaHehn @jflemieux @jfuenmayor @JiaDe-Wu
@Jiahui-Gu @jiangkoumo @jiangtaoliu-source @jimjsong @JimLiu @jimmyjohansson84 @jinglun010-cpu @jinlingzi-cmd
@jinliyl @JinUltimate1995 @JithendraNara @JiuYue0820 @jkobject @jmiguellucas @jmmaloney4 @jnbn @jneeee
@JoaoMarcos44 @joe-rodgers @joe050860 @joelbrilliant @JoelJJohnson @JoelMTaylor @Joeywrz @johnkattenhorn
@Johnny-xuan @johnnykor82 @johnsonAyo @jollyroger1480 @jon-nielsen @jonameijers @JonathanFeller @jondgilbert
@jonh-dev @jonotonfoto @jonpol01 @JonthanaHanh @JonZal @jooray @jordan-thirkle @jordimas
@joseph-mccarey-architect @josephsellers @JoshSnider @joshuadow @journeydan @JPeetz @jplew @jrcrittenden
@jroest @jslee-gif @jtstothard @JuaniLezcano @JulianCruzet @julio-cloudvisor @juliorobertoalvarez @Junass1
@jupiterx0910 @justascesnauskas @justcarlosm @justinsharpe @JustinUssuri @Justlrnal4 @jwilson411 @jxfjosh
@kagura-agent @Kailigithub @kaiomp @kaishi00 @kalice-vi @kallidean @kama-dev @Kame696 @KarateWilly @karmeleon
@Kartik @kaveone @kavioavio @kawanoii @KCAYAAI @kchuang1015 @KeaneYan @keanhartling @keeltrace @keenvc
@keepcalmqqf @keepConcentration @keiranhaax @kelsia14 @kelvmg @kendrickkester @Kenmege @kentimsit @keppy
@kernel-t1 @kerrz2020 @Kerubi-5 @Kesuek @Kev-fs @KevinMeinon @Kewe63 @KeyArgo @keyuyuan @kfchow-ai @KIAgent01
@kidrauhl123 @kilhyeonjun @Kiloris @Kimchi @Kingdomwarrior23 @kingpin44 @kingrubic @Kinkoolino-Hermes
@KiraKatana @kirkins @KiruyaMomochi @KIvanow @kiwipaulrob @kiwiwyl @kiyo-e @kleros109 @KnowBotDev @kohjunhao
@kohoj @kokhlo @Kolektori @koltyj @Komzpa @KoNit-K @konsisumer @Korkyzer @kosazoltan @kouyichi @krapwoo
@kriscolab @kristianvast @krunkosaurus @Kryptonator @kshitijk4poor @kstawiski @ksze @kuangmi-bit @kuehnberger
@kufufu9 @kumaxs @kuntao2011 @kvnloo @kweiner @kyan12 @kylecap9 @kyoto-aircon @kyssta-exe @kyzcreig
@l37525778-coder @L4XB @labyrinth-analytics @Lakescape @lakshyaag-tavily @lanyusea @LaPhilosophie @LarHope
@larrypang @lars-hagen @laulopezreal @LavyaTandel @lawcheck @lawyer112 @lazyants @Lazzdaycod @leakedd
@Leathal1 @leavedrop @Lee-Si-Yoon @leegunwoo98 @leemove @leepoweii @leewaiho @Legion-is-life @LehaoLin @Lei-k
@lekt9 @leomcamilo @leon7609 @LeonardoLGDS @LeonSGP43 @leoprodz @lepetitprince716-prog @lepkov @lesterlxt
@lesterppo @lesyuk @levest28 @lEWFkRAD @lewis4x4 @lexgenius @lfaus @lgy1027 @li-lizhe @liamsmith86 @libre-7
@lidises @lifeFedorovAlexey @LifeJiggy @lightcloud00 @lightx @lihengming @lijinxiao1982 @LikelyLucid
@lilShawtty-byte @linfeng961 @LINGJIAKUN @linxule @Lion-Leporidae @LionGateOS @lipebez @LironTTG
@LisandroNahuelH @littlewwwhite @liuhao1024 @Liuzikaii @liuzinann @liyoungc @lkevincc0 @llbn @lll @locker95
@lofibrainwav @LoicHmh @Lokee86 @Lokeshm24 @loongfay @loongzhao @loqimean @LordMelkor @lorencato23
@lorenzozanee @lost9999 @Louis-Anson @louiswalsh @loulanyue @LovePlayCode @loveRhythm1990 @Lqg97 @lsshawn
@luandiasrj @lubosxyz @Lubrsy706 @lucasfdale @lucaskvasirr @LucidPaths @luckystar2026 @lucvan @luinbytes
@lukefx @Luna161 @luojiesi @LuwenOosten @luxiaolu4827 @luxles @luyao618 @lvabarajithan @LVT382009 @ly6751
@lyswty @Lyti4 @lzmuhioin @m1k3s0 @M1racleShih @Mabolla @macd2 @Machbub @MacroAnarchy @Madkyotiger
@madpower2000 @Maero47 @Magaav @magicbluesmoke @MaheshBhushan @MaheshtheDev @mahgoub @maksir @malaiwah
@manateelazycat @ManniBr @mannnrachman @manny3 @manuelschipper @maoleidiss @mapu-og @Marc @marcolivierlavoie
@MarcosAlves90 @Marcus112-CS @marcusds @mario841859784 @mariomondev @Markgatcha @marko-niskala @markoub
@MarkTro1969 @MarkVLK @martinp09 @martinramos002-bot @MartyLake @mashenchina-max @Mat-London @matantsevs
@matebenyovszky @math0r-be @mathiashuque @MatthewHines @MattMaximo @MaxFreedomPollard @maximalang @MaximCrabbe
@maximilliangrand @MaxKerkula @maxmilian @maxpetrusenko @maxpetrusenkoagent @maxshafransky-a11y @maxtrigify
@MaxyMoos @maymuneth @MazenMkhinini @mazzanfar @mbeattietex1-star @MBK-fr @MCarlomagno @McClean @McHermes
@mcleay @mcpeezy @mdenil @mearls0501 @mechkw @mehmetkr-31 @mekenthompson @memosr @memtomem @Mengchee118
@mengtanx @mengyuyuan @menhguin @MestreY0d4-Uninter @metamindedu @metamon-p @metricano @mettin4 @meviusisback
@mfurkanakinci @mfwagner @mha33 @mheals @Mi55ed @miadisabelle @Mibayy @micah-c02 @michaelversluis
@michaelzelbel @MicroWearld @miguelchaves997-creator @mijanx @mikeest1972 @MikeGibbsOnyx @MilaArtyNew @milkoor
@minchang @minh-alpon @minhngoc25a @Minksgo @mira-solari @miregal89 @MiseHinoha @misschloedupont @misterdas
@mjshorty @mkrb84 @MLcogTech @mmcallister8 @mmcclean-aws @mmchuangyt-ai @mmilutinovic371 @mnajafian-nv
@mnbf9rca @MNIK-YH @mochamgx @mochiNJ @moeadham @Moep90 @MohamadKanso @mohamedorigami-jpg @moisesvalero
@mojomast @moken627-hub @mollusk @Momentum96 @MongLong0214 @MonkeyLeeT @Montbra @Moodtuner997 @moonlight-lupin
@mooserini @mor44-AI @Morad37 @morajabi @MorAlekss @mormio @morolab @moxian @mr-3mm3 @mr-magaia @MrAbsaroka
@MrAtkeens @mrcharlesiv @mrchen0709 @mreso @MrSimonC @mrwanstudio @ms-alan @ms-elbdev @mssteuer @mudrii
@MuhammadUsamaMX @muhifni @Muno459 @murenovich @Mushisushi28 @MustafaKara7 @mwdearing @mxyhi @mykeura
@mzkarami @mzyas @n-leezy @n-WN @nabilaameena @Nagisa-3000 @Nami4D @NaMinhyeok @NanamiMio @nankingjing
@nanobro @napoleonmm83 @natebransc @nateEc @naterchrdsn @Navlem @nca7777 @Ne0teric @Nea74 @NealZhouPanda
@nebneo @Neboy72 @necoweb3 @neerazz @negm17111995 @neil771 @nekwo @nemofq @Neomail2 @neron82
@networthexplained @NexVeridian @nftpoetrist @ngelik @NgThachThanh @nicbj96 @nicecuprani @Nick @nickseelert
@nickzhu0977 @nicoechaniz @nicolasdmolina @nicoloboschi @nidhi-singh02 @nightq @nikkoxgonzales @niklaskie
@NikolaRHristov @nikolay-bratanov @NikolayGusev-astra @nikshepsvn @NingCiQiu @ningfangbin @Ninja @ninjmnky
@Ninso112 @nitishagar @niudakok @nmediaie @NMTZ-z @nnnet @nocoo @nocturnum91 @noestelar @nolanchic @Noor-Sol
@Noshkoto @nosleepcassette @nosliwhtes @NotGovernor @NoTimeforInfinity @notkisk @notwitcheer @NousResearch
@NPFernando @nrmjeremy @ns-fusion @nthrow @null-runner @nv-cho @nv-kasikritc @nv-pberard @NYTEMODEONLY @nyx573
@o3u6x @obierlaire @obtitus @octo-patch @Octopus @Octopustank @ocuclaw @oferlaor @officialasishkumar
@oheckmann74 @ohMyJason @ohmyskyhigh @okaris @oliver-mee @oliverhees @oliviaaaa7788 @olopez25 @olric3015
@oluwadareab12 @olympusbuildz @omar2535 @OmarB97 @omegazheng @omerkaz @omerlefaruk @omert11 @omid-io @OmniaZ1
@OMOX563 @OmX @Only-Code-A @onuraycicek @ooiuuii @OOOOOAO @ooovenenoso @openclawcash @oppih @opriz @orangercat
@orcunulutas @original4422 @osadchiis @oswaldb22 @oswaldvalois @ottosulin @ourines @ous50 @ousiaresearch
@outdog-hwh @outpoints @outsourc-e @OutThisLife @overtoneblue @oxkenshin @oxngon @OYLFLMH @p-andhika
@pandacooming @paoloantinori @Paperclip @paraddox @Paramon @Parker-Fawcett @parsifal295 @pasmud
@patrykkopycinski @PaTTeeL @paultaki @pcaruba @pdmartins @pdonizete @PeaceMaker-best @pecalbezyshodnost-hue
@peetteerr @pefontana @penginman @penwyp @Per0-1 @perng @perqin @PeterFile @peteromallet @PeterTaras @Petra
@petrichor-op @peyton.lu @pgregg88 @phantomthedog @PhilipAD @philmossman @phippsbot-byte @phoebsie
@PhoeniXAbhisheK @phpoh @phuongvm @pierrenode @pincente @pinguarmy @PINKIIILQWQ @pintadoai @Pinutss
@PIR8-Software @piskooooo @pittosporum-seu @PixelAlchemist4 @pju-hoge @plarche-ux @PLASMA-FR @plcunha
@plluviera @Pluviobyte @pmaho @pminervini @pnascimento9596 @pnpwin @poijygfdyy @polkn @polnikale @Polybulle
@PolyphonyRequiem @poponline63 @portavales @Potrock @POWERFULMOVES @Poxel2 @ppazosp @pprism13 @pradeep7127
@praggybuilds @Prasanna28Devadiga @PRATHAMESH75 @praxis1244-consulting @predatorheard-byte @PRELVAS94
@preyevates @Prithvi1994 @privacydied @ProDrifterDK @professorpalmer @ProgramCaiCai @promptclickrun
@protas-box @psam-717 @psionic73 @ptichalouf @purzbeats @Pusch97 @PuvaanRaaj @pxdsgnco @pxls-kaneko @pyr0ken
@qd @qdivan @QDung210 @QifengKuang @qinghuanandejiangshi @qingshan89 @quangphucqp @quocanh261997 @quotumorg
@quqi1599 @qWaitCrypto @qwertyuiop97 @Qwinty @r00tedbrain-backup @r266-tech @r3x443 @raaaas @raajkumars
@rahlquist @rain-sk @rain610 @rainbowgore @raitoxlol @rajitkhanna @Raleighite @ramarivera @ramseshk @randimt
@rapsealk @rarf @rasitakyol @raulbcs @rayblennerhassett-byte @rayjun @raymondyan-zhijie @rayn1314 @rborkow
@rc-int @rcarrata @rchcorp @rcktmonk @re-ITRT @Realmagnum @Realtyxxx @Reaper-Forge @red4711 @redhelix @RegardV
@reinhold-ph @RelaxJonh @remi-td @RemyFevry @ReqX @rerdi92 @revaraver @rewbs @RFingAdam @RGerrish @Rhaphaello
@RHODIZSECURITY @rhushabhvaghela @riandradiva18 @Riccardo-Vecchi @richardcmckinney @ricki-io @RickyYii @RikETS
@rikkarth @Ringo6107 @rio-jeong @ritvikgautam @Rival @rivercrab26 @rjshrjndrn @rkfshakti @rlaope @Rmohid
@rob-maron @RobbertC5 @robbyczgw-cla @RobbyMo81 @robbyslmt @robchristiansen13 @robertaustinbell @roberttidball
@robinradx @Roblmvp @Rockey011 @rockminster @rocks737 @rod-nxtlevel @rodboev @Rodkillah @rodricksz4h5
@rodrigogs @RohiRIK @RohithPariki @rohitsabu @roli-lpci @romanovzky @Rook-CodeVolt @RootZ3n @roqianjas @roraag
@royalaid @RoySRose @rpridal @rrevenanttt @rroverin @rs545837 @rsayar @rshi0212 @rtcopenclawgh @ruangraung
@rudironsoni @rudrakshchahal @rudycelekli @ruizanthony @runninwithitmarketing @RunzhouLi @ruochu88s
@ruslanvasylev @Ruzzgar @rweddle @ryangu00 @ryantuc @RyanUnderhill @ryrenz @RyTsYdUp @s-jag @s905060
@SacrEllfarch @saforem2 @sagitario-jpn @SaguaroDev @sahibzada-allahyar @Sahil-SS9 @Sahilvishnaliya
@sahlbergalfred4-lgtm @saiteja-madha @sakhnenkoff @Sakujakira @salch-cred @salehelsayed @SaM13997 @samalone
@sambouli @samfoy @samplesabotage @samrusani @Samuek9 @samuelpatro @sanastasiou @SandroHub013 @Sanjays2402
@saotu @sarahwu185 @sarayd @sarbai @sarthak-707 @sarvesh1327 @sasan1200 @Sasni @sasquatch9818
@satirojordi-boop @SayHell0W0rld @sbe27 @ScaleLeanChris @schrodienieur @schwinguin @scottaki @scottgl9
@scottlowry @scroasdale @scross01 @sdalonzo @sdyckjq-lab @sealca @SeashoreShi @season179 @seb-almeida
@Sebuska29190 @secsson @see-k @SelfParody @seluvia @semirkabir @Sensie-agents @serefyarar @sergeikabuldzhanov
@Sergey0515 @sergioperezcheco @sgaofen @sgarrand @sgtworkman @Sha01in @shaase-ctrl @shadus @shafdev
@shagghiesuperstar @shali10 @shane9coy @shannonsands @shashwatgokhe @shaun0927 @shauryajain21 @shawnpana
@shehjaddev @shellybotmoyer @Shenrui-Ma @sherman-yang @Shimakaze514 @shivasymbl @shl0ms @shoesroom13
@shorehefei-ship-it @Shotflame @shreyanshj10 @shuanzhi @Shy7777 @SiaoZeng @siillee @silentpr0 @SilverNine
@simbam99 @SimoKiihamaki @simpolism @sinh2024 @Sisyphus @sitkarev @sjahlstrom @sjiangtao2024 @sjungwon03 @sk
@skappafrost @skyc1e @skyeconcontracting-ctrl @skyer-flyyy @skyeyesec333 @skylarbpayne @slash1andy @Slobaka
@sloik @Slopez2023 @sly321-pixel @SmallNew2003 @SmelterLabs @smfworks @smtony @snipecoder @SNooZyy2
@snowdchike @socrates1024 @soddy022 @sohomsahaun @soichiyo @Soju06 @Solitud1nem @solovision24
@someoneexistsontheinternet @somewheresy @sonderhq @songshikang0111 @Sonnenwerk @Sora-bluesky @sorenisanerd
@soroush5 @soyami @soyelmismo @soymarketing @soynchux @spanishflu-est1918 @spfcraze @spideystreet
@spiky02plateau @spranab @sprmn24 @SquabbyZ @squevo @sroecker @srojk34 @ssep4u @ssiweifnag @SsSs
@stablegenius49 @StanleyStetson @stantheman0128 @starship-s @startakovsky @SteelPh0enix @StefanIsMe
@stefanpieter @StellarisW @stepanov1975 @stephan @Steve-prog001 @steveafrost @stevehsu0524 @steveonjava
@stods21 @StodsEcho5 @Stoltemberg @StreamOfRon @stremtec @strzhao @Studio729 @Subway2023 @successionbio
@sudhirpatil @sudoingx @suhas-svg @sujeet111 @SulthanZahran1 @sum117 @sunsakis @sunwz1115 @superafun
@superb-cation @supere989 @Superfly73 @superlowburn @superposition @supotato-ipj @supplefrog @Svector-anu
@sweetcornna @sxuff @sy0u1ti @sycamoregroupltd @sylvainCDA @sylvesterkaczmarek @Synero @synscott @szcharlesji
@szicely @SZWzz @szymonclawd @szzhoujiarui-sketch @t1mdurden @T910317 @tachyon-r @tainguyenphat74 @TakeshiTGAL
@TalOrbach @Tamaz-sujashvili @tancou @tangtaizong666 @tank321 @TaoMasterCoder @tarkilhk @TartarusLabs
@tauros1983 @taxbax @taylorwtf @tcconnally @teakesdev @teamster22 @teddychenfeiyang-png @Teknium @temalo
@ten-ltw @ten82e @tensorbit89-netizen @teo-nex @terminamike666 @Test @teyrebaz33 @TFOjojo @tfournet
@th3sull1van @thanhan-a17 @tharanee-bit @thatssoheil @the-cybersapien @the-repeter @The-x-35 @the3asic
@TheAirick @TheAngryPit @thebergerking91 @thebizfixer @TheBlueHouse75 @thedavidweng @thefiredev-cloud
@TheGardenGallery @thegoodguysla @thegreatesthoneybee @thejpanganiban @TheNeuralVault @theone139344
@thepetenetwork @ThereWasAYang @TheSmokeDev @TheStreamCode @thetasigmaio @thinkingsheep @thomasscottbeck-sudo
@ThyFriendlyFox @tian0cai @tianma-if @tianyu-liu @ticketclosed-wontfix @tigercraft4 @Tigrannnnnnn @tim404x
@TimeLord2010 @timknip @timmycheng @timoteo7 @timrichardson @timsmykov @tinetwork @tjboudreaux @tjp2021
@tk-pkm111 @tkaufmann @tkwong @tmaarcxs @tmchow @tmielika @to-na @toannhu96 @tobenwarrior @tokou @tomatau
@tomekdot @Tomenatore @tomkubik @tommulkins @Tommy00748 @tomqiaozc @tony-simons-aiowa @Tormen28 @Tosko4
@Totoro-qaq @tpte @trac3r726 @Tranquil-Flow @tranquilflow @treatux @trevorgordon981 @trevornk @Treytucker05
@trippyogi @Triquetra @trnorga @Trounaldo @TroyMitchell911 @truenorth-lj @trwpang @tsemana @tsubasakong
@tsuk1nose @Tsuki-hash @tt-a1i @tuancookiez-hub @TUARAN @tudorpastorglencore @tugrulguner @tupe12334
@TurgayAcar49 @TurgutKural @turingcat @tutan0558 @TutkuEroglu @tw2818 @twe-cloud @twidtwid @twotnguyen @txhno
@tylerbrevard @tylman @tymrtn @tynamite @ubxty @Udjin79 @Ufonik88 @UfukNode @ugoenyioha @UltraInstinct0x
@umi008 @UnathiCodex @underthestars-zhy @UniversePeak @unmodeled-tyler @unsupportedpastels @usvimal
@uttkarsh-26 @uzairchhapra @uzaylisak @uzunkuyruk @vadimcomanescu @vaibhavarora14 @valda @valentt @valerdoskin
@vbcherepanov @vectorcmd @vectorcontext @vectorforge22 @VencentSoliman @Versun @vet402 @vgarlu @VGFreakXBL
@victor-kyriazakos @victorftrdba @victorGPT @victorjmilagres @VictorTran1023 @VictorYXL @vikyw89 @vilkasdev
@virattt @virtaava @Vissirexa @vitobotta @vjpixel @vKongv @vladzablotski-adaption @Vocllum @vollegrewar
@vominh1919 @VrtxOmega @vsd2807 @Vsemagush @vshulcz @vykhovanets @w-up @wa1939 @WadydX @walidboulanouar @wang2
@wangs1203 @wangtaotaotao95 @wanliqin @warabe1122 @warmheartrobot @waroffchange @WAXLYY @wdelarme @wdon
@web3blind @webdevfrancisco @webdevtodayjason @webtecnica @webtoolbox @Weidows @weidzhou @weltmaister
@Wenfengcheng @wesleysimplicio @westkite1201 @whirmill @WhiteWorld @whoisdhana @whyyagswhy @WideLee
@will-lynas @willardgmoore @willfrombr @Willhong @williamtwomey @willy-scr @wilsen0 @wliu-dev @wnuuee1
@woaini30050 @wodesiku @WolframRavenwolf @WolftacDigital @woota @wooyongbin3-cpu @woriwka-ai @worlldz
@woshicby @wpengpeng168 @wukangcheng1994 @WuKongAI-CMU @wuli666 @WuTianyi123 @wuwuzhijing @wxy-nlp @Wysie
@WYSTAF @wz-heng @wzslr321 @x1am1 @x7peeps @xiajiahang @xiaodu55 @XiaoXiao0221 @xiaoxinova @xiaoyaner0201
@xielevi @xinbenlv @Xingkai98 @Xipong @Xixiartemis @xjsns346 @xkam7ar @xmhuangzhijun-hue @Xowiek @xoy8n @xpk84
@xraysight @xrbs00 @XtremXpert @xuezhaolan @xushibo @Xuxyyy @xuyuann @xxxigm @xy200303 @xy952666680 @xz-dev
@y0shua1ee @Yabuku-xD @yagna @yahuo @yaleman @YanSte @yaojiejia @yaozhen @yashiels @yatesjalex @yavarb @ydmw74
@yehuosi @yellowdog01 @ygd58 @Yicheng-Mark @yingliang-zhang @yinkev @YLChen-007 @ymat19 @ymybxx @yoannes
@YonganZhang @Yongcheng123 @yongli-abc @yoniebans @yotamleo @youcefcherid @Youssef @youssefea @youtiaowei
@yoyodine-industries @ypwcharles @yu-xin-c @YUAN @yuanchenglu @yubingz @yuchenwang3 @yuexiongHNU
@yuga-hashimoto @YuhGuan @Yun. @yungchentang @yunke98888-gif @yunze7373 @YuShu @YusukeOshima-5564 @YuYigeng
@yuzilongleif-collab @ywatanabe1989 @yy28 @yyovil @yyq4193 @yyzquwu @yzy806806 @z0zero @z23 @zaclanzon
@zagiscoming @zakiyys @zakolenko @zanzipanzi @zapabob @zay @zaze-oO @zccyman @zebadee2kk @Zechereh @zeejaytan
@zengzheqing @zenplace-system @ZenSchema @Zeraphim @zerone0x @ZeroOttantotto @Zeus-Deus @zhangxicen @zhao0112
@ZHCHJ888 @ZHJay @zhongwater123 @zhongyueming1121 @Zhou-Ruichen @zhouhe-xydt @Zhuzewen2023 @ZidoCode
@zihaofeng2001 @zilvinasu @zindar @ZishiW @ziwon @zjc-enigma @zmlgit @zohuyhieuzo03 @zoser69 @zqy1-1
@zrmnelson @zsuroy @ZT-Toolkit @zufeyan @zwcf5200 @zxcasongs @zxdvd @zyz619963502zyz @zzpigpinggai @zzragida
@zzz163519

Also: @Leanolf (Leanolf+212960991), @ayushnangia (55181294+ayushnangia), @DavidMetcalfe (dmetcalfe+hermes), benoit.lavenier, Adrian Scott, Ahmed Khaled, Alberto Leal, Alex Ferrari, Andrei Ignat, Animesh Mishra, Bosco Barros, Chris DePuy, d4rk pr10r, Daniel van Strien, Dave Bunn, Dogila Developer, Eduardo Christopher López Acevedo, George Shalhoub, Hermes Agent / OpenAI Codex / gpt-6-sol, Isaac Dobson, JP Lew, Konrad Czarski-Bonanaty, Lars van der Zande, leo yang, Lucas Nicolas, Magnus Ahmad, Marco Rutsch, Mark Sheppard, Martin Gontovnikas, Matt McFarland, Michał Dziwisz, namhyuk kim, Nikolas de Hor, Nils (Norya), Paul Bergeron, Paulo Henrique, Robert Montelongo, Sebastian Bochna, Siddharth Balyan, Teo , Timo Karp, Val Alexander, wave-2 worker D, Wes Hermes, Yannick Stephan, Yash Jain, Your Name, Ömer Faruk Okumuş, 史官.

---

**Full Changelog**: [v2026.8.31...v0.22.0](https://github.com/NousResearch/hermes-agent/compare/v2026.8.31...v0.22.0)

*This release rolls up and fully documents the v0.21.1–v0.21.7 patch releases (Sep 7 – Oct 11), whose notes were deferred to this minor.*
