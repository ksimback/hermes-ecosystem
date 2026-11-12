# Hermes Agent v0.22.2 Release Notes

**Version:** v0.22.2
**Published:** 2026-10-15T08:21:32Z
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v0.22.2

# Hermes Agent v0.22.2

**Release Date:** October 15, 2026

v0.22.1 was built from the wrong commit. It shipped unreleased gateway work, and the Microsoft Store app could stick on "Connecting." 0.22.2 is the release 0.22.1 was meant to be.

> **Known issue:** Sessions that ran under the 0.22.1 gateway can't be deleted in 0.22.2.

<!-- HERMES_BUILDS_TABLE -->

## Highlights

- **The gateway starts after a reboot again.** After a restart, Linux can hand an early PID to an unrelated process, and the gateway could mistake it for a running gateway, so a supervised gateway (systemd, launchd, Docker) refused to start. Hermes now records the boot it started in, and when it can't tell, it asks the host lock, which only a live gateway holds. ([#138594](https://github.com/NousResearch/hermes-agent/pull/138594), fixes [#133744](https://github.com/NousResearch/hermes-agent/issues/133744))
- **Long local-model turns survive on laptops.** Local requests always stream with prompt-reading progress (shown in the status line), stall timers skip time the machine was asleep, a recovered local server gets another try instead of a breaker that failed every later message, and compression no longer times out while the server is still reading a long conversation. On Windows unified-memory machines, model launch and the prompt cache are sized to free memory. ([#138560](https://github.com/NousResearch/hermes-agent/pull/138560))

Below is everything in the 0.22 release line since v0.22.0: the fixes 0.22.1 was meant to ship, plus the two above. Work that is only on `main` ships with v0.23.0.

## ✨ Features

- **Release:** split the Microsoft Store bundle into its own windows-store lane ([`f9d8a740`](https://github.com/NousResearch/hermes-agent/commit/f9d8a74035101d95ef2a622fb01b2f9bbc34f0ef)) — @ethernet8023
- **Agent:** add nemotron super 3.5 default parameters ([`c59d2994`](https://github.com/NousResearch/hermes-agent/commit/c59d299408e924c3682619e7d9d368891d4b709e)) — @elisam0
- **Cli:** add nemotron to NVIDIA NIM default model list ([`cc55270e`](https://github.com/NousResearch/hermes-agent/commit/cc55270ec033729ed04f510fba3737aa65e027a7)) — @elisam0
- **Cli:** add curated model list at the top in the model picker list ([`e6835fd3`](https://github.com/NousResearch/hermes-agent/commit/e6835fd3cb3bb399ce06cac5356c36226483b889)) — @elisam0
- **Release:** choose what a stable release builds and tests with lanes ([`36a8ee18`](https://github.com/NousResearch/hermes-agent/commit/36a8ee18cd77b05b42316b60a5e2809587e28e70)) — @ethernet8023
- **Plugin-catalog:** add hermes-lang-ko — Korean Desktop language pack ([`e5f49b6a`](https://github.com/NousResearch/hermes-agent/commit/e5f49b6a17a9bd623da961d86b779d523a09227c)) — @dandacompany
- Plugin-catalog: add hermes-lang-pt-br (Brazilian Portuguese language pack) ([`0169e80c`](https://github.com/NousResearch/hermes-agent/commit/0169e80c7dbb6d2d2a33126310f5c5c075e1952a)) — @StudioCodeAI
- Contributors: add 2867297362mjb-sketch email mapping ([`9ab40641`](https://github.com/NousResearch/hermes-agent/commit/9ab406415ca184c4f9b64b32cf5ced417babb2f2)) — @2867297362mjb-sketch
- Plugin-catalog: add teamorouter (TeamoRouter model providers) ([`ef223406`](https://github.com/NousResearch/hermes-agent/commit/ef223406225638a73e8f9c1536a734bb7addfe18)) — @2867297362mjb-sketch
- **Plugin-catalog:** add author-feed ([`5f6d6836`](https://github.com/NousResearch/hermes-agent/commit/5f6d6836cc80051e297936b4467a91d7c4925039)) — @TakeshiTGAL
- **Plugin-catalog:** bump aux-ledger to 1.4.0 ([`6048066e`](https://github.com/NousResearch/hermes-agent/commit/6048066e22f3019505d04caeab29577c803f4d71)) — @olric3015
- **Plugin-catalog:** add the wait-ledger catalog card ([`77cb58e5`](https://github.com/NousResearch/hermes-agent/commit/77cb58e56ac47d5e3aa1ee720d4bcd7a8c6a8513)) — @olric3015
- **Plugin-catalog:** add wait-ledger ([`97e65322`](https://github.com/NousResearch/hermes-agent/commit/97e65322efebd1b8dc07d33634b685df078d5858)) — @olric3015
- Community plugin: lightningai + lightningai-rate-limit ([`07515466`](https://github.com/NousResearch/hermes-agent/commit/075154660043fe5656ec3ca48c93d6a6f9755494)) — @dinosauria123
- Catalog: add Hermes AAC 0.1.0 at reviewed exact source pin ([`7c9adda8`](https://github.com/NousResearch/hermes-agent/commit/7c9adda81a2d152ba4f63fe6aecf59385dfc3284)) — @TREE-Ind
- **Plugin-catalog:** add openinvest ([`b6e86101`](https://github.com/NousResearch/hermes-agent/commit/b6e86101c29593785c81eb8d380e2faef2530d5f)) — @longsizhuo
- Catalog: add hermes-agent-mixer (v0.2.0 @ 04c4e13) ([`2e7e3859`](https://github.com/NousResearch/hermes-agent/commit/2e7e385959dc65ceb3053724724d8a5f526c675d)) — @Sahil-SS9
- **Plugins:** move Kumiho Memory to memory catalog shelf ([`46f95e08`](https://github.com/NousResearch/hermes-agent/commit/46f95e086379a2d701595b981cb94733fd060384)) — @kaveone
- **Release:** dispatch Stable Release from the default branch ([`667e6639`](https://github.com/NousResearch/hermes-agent/commit/667e6639af61d827eb5be4764e6b71aa7f5d88ac)) — @ethernet8023

## 🔧 Improvements

- **Agent:** keep the Mistral tool-id rule beside its only consumer ([`c5fc0958`](https://github.com/NousResearch/hermes-agent/commit/c5fc0958b49f415041c7f356c8bdf9f914037e89)) — @kshitijk4poor
- **Profiles:** build the seed routing view once; expand `enabled` too ([`311155fa`](https://github.com/NousResearch/hermes-agent/commit/311155fade43d1993ea968909a2ad36762345bbc)) — @kshitijk4poor
- **Profiles:** simplify the model seed and trim its tests ([`d9dfb124`](https://github.com/NousResearch/hermes-agent/commit/d9dfb1243b20e72df6ef66782e3c7ad192e7fcca)) — @kshitijk4poor
- Update nemotron super 3.5 name ([`3224993a`](https://github.com/NousResearch/hermes-agent/commit/3224993af1860ffdb587e491560f32bf845c82ad)) — @elisam0
- **Hermes_cli:** update nemotron 3.5 name ([`108ae4e7`](https://github.com/NousResearch/hermes-agent/commit/108ae4e7cd4c89a95545b1cdab3e1b72ce220755)) — @elisam0
- Catalog: re-pin showly to the build without the upstream self-update check ([`6462f64a`](https://github.com/NousResearch/hermes-agent/commit/6462f64aefba9271f9977edcd430d61141d4d760)) — @slchris
- Catalog: update Model Router to v0.4.3 native preferences ([`6a097ee9`](https://github.com/NousResearch/hermes-agent/commit/6a097ee98d4c96eafa9ef76c98c3c39d6d65a0da)) — @metamindedu

## 🐛 Bug Fixes

- **Gateway:** a recorded boot epoch that cannot be compared is unprovable ([`79b3b724`](https://github.com/NousResearch/hermes-agent/commit/79b3b7243535d02c785a4ffac6ae1cb9fa54f47b)) — @ethernet8023
- **Local:** keep long local-model turns alive on laptops ([`518ce272`](https://github.com/NousResearch/hermes-agent/commit/518ce272b922ab24048696b3b2d322633ef7e6d1)) — @emozilla
- **Gateway:** a read-only host-record check never creates the lock file ([`91e63f84`](https://github.com/NousResearch/hermes-agent/commit/91e63f843d7656e307fc2c7608d70570f5cf24a3)) — @kshitijk4poor
- **Gateway:** let the host lock decide a legacy record that looks older than this boot ([`4d984677`](https://github.com/NousResearch/hermes-agent/commit/4d984677b655fe617a48acf159c90c072cfa3ccd)) — @ethernet8023
- **Gateway:** anchor the legacy host-record check on boot time, not a live create_time ([`5b416e42`](https://github.com/NousResearch/hermes-agent/commit/5b416e423ba8c61667c09afbe4b91be3e07d4b0b)) — @ethernet8023
- **Gateway:** drop argv identity from host rendezvous liveness ([`c7fa3cbf`](https://github.com/NousResearch/hermes-agent/commit/c7fa3cbfaa67c26842e26e5e3fc94c03f7895875)) — @sin5ddd
- **Gateway:** reject a recycled PID that only matches start ticks ([`7934442e`](https://github.com/NousResearch/hermes-agent/commit/7934442e567850c51b2f00a03d1261dfcb336f53)) — @sin5ddd
- **Tui:** keep a ${VAR} bare-custom endpoint as a ref in the new profile ([`dd2db134`](https://github.com/NousResearch/hermes-agent/commit/dd2db134920ad4a2224c483c6d2cf7725dd7ee79)) — @kshitijk4poor
- **Tui:** a new profile inherits a bare `custom` launch model with its endpoint ([`463d4019`](https://github.com/NousResearch/hermes-agent/commit/463d40192d92805d2139c2f63e481bffa2151154)) — @kshitijk4poor
- **Release:** a Store-only Windows build gets no signing vars; Store-plus-macOS smokes record only macOS ([`a8cc19eb`](https://github.com/NousResearch/hermes-agent/commit/a8cc19ebfdc24fa3534af50346d250f2a71dfa8e)) — @ethernet8023
- **Agent:** keep composite tool ids paired on Mistral routes ([`0c1bfb7d`](https://github.com/NousResearch/hermes-agent/commit/0c1bfb7dfb477f1583231284f6dce7a363ce9bf5)) — @kshitijk4poor
- **Agent:** rewrite split tool ids before Mistral sees them ([`b33ed359`](https://github.com/NousResearch/hermes-agent/commit/b33ed35968f00896e093fa41735af7c108e6bead)) — @xxxigm
- **Release:** macOS smoke runs when no receipt was staged ([`f546ea2f`](https://github.com/NousResearch/hermes-agent/commit/f546ea2f1d9bbee87d42041da45d3e5ca36d1d3c)) — @ethernet8023
- **Install-e2e:** preserve bundled Windows process arrays ([`6db1934d`](https://github.com/NousResearch/hermes-agent/commit/6db1934d0537c5b9676d46d0641762acc4f665e5)) — @Oceanswave
- **Profiles:** match env-referenced endpoint names when seeding a profile ([`7b755ed5`](https://github.com/NousResearch/hermes-agent/commit/7b755ed5195a9379871c8d35ecc5e56c274148a5)) — @kshitijk4poor
- **Profiles:** drop every same-identity destination entry when merging ([`9a9a6e43`](https://github.com/NousResearch/hermes-agent/commit/9a9a6e43e4c20c162c60efdbc99897feab42cb41)) — @kshitijk4poor
- **Profiles:** match endpoint identity the way runtime does when merging ([`ef57cbd9`](https://github.com/NousResearch/hermes-agent/commit/ef57cbd94613a96191d14f2e1dc8de17c7bbd365)) — @kshitijk4poor
- **Profiles:** keep URL-less destination entries when merging the endpoint seed ([`2aa469f7`](https://github.com/NousResearch/hermes-agent/commit/2aa469f76c189c402a5595890bbcc9b18bcab775)) — @kshitijk4poor
- **Profiles:** inherited endpoint is not shadowed by the profile's own entries ([`ac0b63af`](https://github.com/NousResearch/hermes-agent/commit/ac0b63afacabad685dff8d1101ebce574565b92c)) — @kshitijk4poor
- **Profiles:** select the seeded endpoint from an env-referenced provider ([`c85302a2`](https://github.com/NousResearch/hermes-agent/commit/c85302a269c8fe927ace7ef806e8a3f0af2e2cb4)) — @kshitijk4poor
- **Profiles:** keep bare custom provider tuning in the model seed ([`424aa90f`](https://github.com/NousResearch/hermes-agent/commit/424aa90f22fb1083d2811fdac80b5e817cdc6b66)) — @kshitijk4poor
- **Profiles:** reuse named provider lookup without credential reads ([`c8a777ff`](https://github.com/NousResearch/hermes-agent/commit/c8a777ffc2b3b71082da8d000e14d680c086d7df)) — @helix4u
- **Profiles:** align model seed with provider resolution ([`5fee8d77`](https://github.com/NousResearch/hermes-agent/commit/5fee8d77bf91ea2e34817817334f98fe93a5b8f6)) — @helix4u
- **Profiles:** inherit canonical and legacy custom endpoints ([`2d3e75aa`](https://github.com/NousResearch/hermes-agent/commit/2d3e75aab02f044000110137a0503b5fa2114367)) — @helix4u
- Drop the VPN/proxy advice from the CDN-block message ([`300228d2`](https://github.com/NousResearch/hermes-agent/commit/300228d24c593f779055204753921fbe9a2163c5))
- Scope the no-cf-cache-status block signal to our R2 host; keep it on 429s ([`ec5fa1e4`](https://github.com/NousResearch/hermes-agent/commit/ec5fa1e437a8f653fb74048fbc0315f962c1014a))
- Name a CDN firewall block instead of a bare HTTP 403 (#128295) ([#128295](https://github.com/NousResearch/hermes-agent/pull/128295))
- **Release:** termux-only claims finish and partial releases keep the shared downloads page ([`6743ab71`](https://github.com/NousResearch/hermes-agent/commit/6743ab711a2f354210ba5345aa0a39c551d5c4bc)) — @ethernet8023
- **Ci:** packaged-update acceptance retries a download whose connection resets ([`db4a6a9e`](https://github.com/NousResearch/hermes-agent/commit/db4a6a9e264e4e236ab06db04bba009eb8154c17)) — @ethernet8023
- **Catalog:** re-pin Agent Mixer after maintainer review ([`4297a692`](https://github.com/NousResearch/hermes-agent/commit/4297a692d9570e039aa8c7bfde900ffca420eaff)) — @Sahil-SS9
- Pin Activity v0.2.1 public credential routes ([`3dac1f07`](https://github.com/NousResearch/hermes-agent/commit/3dac1f07d59f7f300f6f3433cef1bf8966b763c4)) — @hassan-kamel
- **Plugin-catalog:** update jp-egov-law to f1dd47e ([`c029046d`](https://github.com/NousResearch/hermes-agent/commit/c029046d7c87635833db1c1508af3e4f812f3c6a)) — @TakeshiTGAL
- **Plugin-catalog:** update switchbot-control to d0e6f77 ([`c4bf61b1`](https://github.com/NousResearch/hermes-agent/commit/c4bf61b126a60172d2598b923fd08b1d60b1e84f)) — @TakeshiTGAL
- **Install-e2e:** the Windows packaged-app feed serves byte ranges ([`1f6c02c0`](https://github.com/NousResearch/hermes-agent/commit/1f6c02c07c697026888f1c66e634534fa2aae358))
- **Pm:** re-merge the uv cache seed on volumes marked by a seedless image ([`1226894b`](https://github.com/NousResearch/hermes-agent/commit/1226894bf9bd0e9067f8c040a3ff32a3c800483e)) — @ethernet8023
- **Release:** publish replaces the stable head instead of create-only ([`df8c3ca5`](https://github.com/NousResearch/hermes-agent/commit/df8c3ca54e7dca3b907544b2d5bedfb1987a8d93))
- **Release:** keep a stable run on main from using the controller commit or cancelling pushes ([`0dbd96ab`](https://github.com/NousResearch/hermes-agent/commit/0dbd96ab7026157f2d43bf2aa73aad5efb818910)) — @ethernet8023
- **Pm:** stage a version for version-less buildable plugin members too ([`3d8dfc1d`](https://github.com/NousResearch/hermes-agent/commit/3d8dfc1da262e3f9cba23c091f8ead1082ed68d7)) — @ethernet8023
- **Pm:** don't stamp project.version on members declaring it dynamic ([`2a10164c`](https://github.com/NousResearch/hermes-agent/commit/2a10164cd56fa1b9a46f036e04a4fc53a19426cd)) — @Ieqzya
- **Pm:** give generated virtual workspace members a project.version ([`357986e5`](https://github.com/NousResearch/hermes-agent/commit/357986e589c01f154adbdeba31e8d47a8e0cac09)) — @Ieqzya
- **Pm:** retry sync without bytecode compile when that step fails ([`10619939`](https://github.com/NousResearch/hermes-agent/commit/106199392a1818b390ad5440a556fadd65fc8bb2)) — @smfworks
- **Deps:** bump httpx2/httpcore2 2.7.0 -> 2.12.0 for the audit advisories ([`bc8545bd`](https://github.com/NousResearch/hermes-agent/commit/bc8545bd1abec63bb69a6dc464ed62ae95d224bc)) — @guthixboss1
- **Doctor:** stop mislabeling the root npm audit row as agent-browser ([`7b1dc974`](https://github.com/NousResearch/hermes-agent/commit/7b1dc974afc9262824344423eca3c7c7b9b971d9)) — @chelsealong
- **Doctor:** say recreating the same Docker image does not fix npm findings ([`dee35e1d`](https://github.com/NousResearch/hermes-agent/commit/dee35e1d536a80bad600333d0842e9c7409b16ff)) — @ethernet8023
- **Doctor:** describe full workspace npm audit scope ([`b9dda06b`](https://github.com/NousResearch/hermes-agent/commit/b9dda06bbf6d08cca8112fbbbcf631abc06b241a)) — @dwaxe
- **Doctor:** clarify Docker npm audit remediation ([`e21caa27`](https://github.com/NousResearch/hermes-agent/commit/e21caa27b75a880536ac3429f70c356ece19a330)) — @KoNit-K
- **Deps:** bump the WhatsApp bridge lock past its npm-audit findings ([`231cb757`](https://github.com/NousResearch/hermes-agent/commit/231cb757a4607e6b44e13c154696e869fd959102)) — @ethernet8023
- **Deps:** land source-map-js 1.2.2 and sync the workspace pins to the overrides ([`f57d12eb`](https://github.com/NousResearch/hermes-agent/commit/f57d12ebd4e6fe67485dcaee13db4375a1114710)) — @ethernet8023
- **Deps:** bump pinned npm packages to clear npm audit findings ([`732f0f17`](https://github.com/NousResearch/hermes-agent/commit/732f0f1769313828468161ad387ad399033bd0ba)) — @sajidhaleem
- **Windows:** packaged-npx install failures degrade to plain npx; payload venv must be real ([`84e2250b`](https://github.com/NousResearch/hermes-agent/commit/84e2250b1065ce7637553b94423fffa275a3dd72)) — @ethernet8023
- **Docker:** ship the build's uv cache at the PM seed path ([`f4e70b9d`](https://github.com/NousResearch/hermes-agent/commit/f4e70b9d843c2580a9a56de357baa6fa368d089d)) — @ethernet8023
- **Release:** publish the final vX.Y.Z Docker tag again ([`c1100232`](https://github.com/NousResearch/hermes-agent/commit/c11002329bac69df3f1e5fefbef5232c804ec599)) — @ethernet8023
- **Pm:** npm on PATH is the pinned npm, not the copy bundled inside node ([`8d3b5ab5`](https://github.com/NousResearch/hermes-agent/commit/8d3b5ab54452daaa7c848aba396a9cbdfcd50c3b)) — @ethernet8023
- **Windows:** an MSIX with no Node to copy runs npx MCP servers on its packaged node ([`8ef7654b`](https://github.com/NousResearch/hermes-agent/commit/8ef7654bf53e76a4121f877b3acace56c367707d)) — @ethernet8023
- **Windows:** MSIX terminal and MCP children get node, npm and python copied outside the package ([`c7abf4fb`](https://github.com/NousResearch/hermes-agent/commit/c7abf4fb728630bf5425cd5542011bc5423cdc6c)) — @ethernet8023
- **Terminal:** the user's own tools come before Hermes's in the terminal ([`162b457c`](https://github.com/NousResearch/hermes-agent/commit/162b457c8e2a24ccc8041fba4ce9fb2c77b77a96)) — @ethernet8023
- **Search:** local file search runs Hermes's pinned ripgrep, not the first rg on PATH ([`9b4710b8`](https://github.com/NousResearch/hermes-agent/commit/9b4710b829ffb2d7660c5f7cdb134cc0dfe86a03)) — @ethernet8023
- **Terminal:** strip a sealed payload's venv from child PYTHONPATH ([`671996b1`](https://github.com/NousResearch/hermes-agent/commit/671996b152e6b45953e0c539c4f8482d89b3f335)) — @ethernet8023

## 📚 Documentation

- **Agent:** use the released model name Nemotron 3.5 Super VL ([`79651b71`](https://github.com/NousResearch/hermes-agent/commit/79651b71bd56efd76d06f3de1df64dde09b58ff3)) — @j-nolan
- **Agent:** name the guidance blocks and drop the unsupported claims ([`ba498735`](https://github.com/NousResearch/hermes-agent/commit/ba498735a09b896596ab750270434a0705d0b047)) — @j-nolan
- **Agent:** note that the guidance blocks were tested on Nemotron without effect ([`2b57b0db`](https://github.com/NousResearch/hermes-agent/commit/2b57b0dbe8431cd9688cce1efe6e21543b4ccfbc)) — @j-nolan
- **Providers:** rephrased content ([`4f8df7e1`](https://github.com/NousResearch/hermes-agent/commit/4f8df7e14d0f75a9ed44482dbae218648b40ac96)) — @nv-pberard
- **Env:** add NVIDIA NIM to .env example ([`3dd96101`](https://github.com/NousResearch/hermes-agent/commit/3dd961013c57398b4ba42d16f5bcc3772baa0701)) — @elisam0
- **Providers:** use a non-cloud example key for local NIM ([`da463310`](https://github.com/NousResearch/hermes-agent/commit/da463310b1e31d8690b1aac6d3701798bb36a06e)) — @rroverin
- **Providers:** update NVIDIA NIM example to Nemotron 3.5 Super VL ([`c5bab4af`](https://github.com/NousResearch/hermes-agent/commit/c5bab4afdf39de0062f8a2c1964556a5875c72e7)) — @rroverin
- Local Models is on by default on macOS, Windows and Linux ([`1e8bf3ee`](https://github.com/NousResearch/hermes-agent/commit/1e8bf3ee46f60987799b2ac54ce6e73630741029))

## 🧪 Tests

- **Agent:** pin Mistral's 9-character tool id on the wire ([`9a90a825`](https://github.com/NousResearch/hermes-agent/commit/9a90a825022e0283f0e4c339e4ca2f6e3e09454c)) — @xxxigm
- **Profiles:** pin same-identity eviction of URL-less and disabled entries ([`0f447876`](https://github.com/NousResearch/hermes-agent/commit/0f447876cab9df48b225172cf167b3254b06f1a5)) — @kshitijk4poor
- **Profiles:** pin that the model seed copies only the selected endpoint ([`29db211b`](https://github.com/NousResearch/hermes-agent/commit/29db211b48c52ac248d5ab38af6a02dc466ed552)) — @kshitijk4poor
- **Agent:** add reasoning timeout default test ([`73a07104`](https://github.com/NousResearch/hermes-agent/commit/73a07104e9ede6f6cecdc4d6b9735dc2ec2c2d85)) — @elisam0
- **Relay:** the OpenAI-stream e2e no longer self-deadlocks when the stream is buffered ([`6e84ce66`](https://github.com/NousResearch/hermes-agent/commit/6e84ce66fb577ceeaf43a1e2da773e70609953d2))
- **Pm:** one streamed-sync test covers the bytecode-compile retry ([`7f21aad1`](https://github.com/NousResearch/hermes-agent/commit/7f21aad154b1573f08c450d6e055bf101c4d2c8e)) — @ethernet8023
- **Deps:** fail the build if an httpx2 pin or lock entry drops below 2.12.0 ([`3ca10d88`](https://github.com/NousResearch/hermes-agent/commit/3ca10d881c388201e476ed05505afb3197306e35)) — @jarvistwil
- **Doctor:** point the root-row label test at the staged-npm seam ([`40441695`](https://github.com/NousResearch/hermes-agent/commit/4044169558432a49d3e8bdda388d458f93149183)) — @ethernet8023
- **Pm:** allow-list the packaged-npx node lookups in the resolution ratchet ([`c4f9a169`](https://github.com/NousResearch/hermes-agent/commit/c4f9a169d61c2d75762c18e57f458b1aee2fed5b)) — @ethernet8023

## 🏗️ Infrastructure

- **Release:** admit stable releases from release/* branches, not just main ([`9686d55c`](https://github.com/NousResearch/hermes-agent/commit/9686d55ca87ccb22f779f012dd1ced7cdf63e0b9)) — @ethernet8023
- Map contributor email for sin5ddd (#133750 salvage) ([#133750](https://github.com/NousResearch/hermes-agent/pull/133750)) — @kshitijk4poor
- Map Oceanswave noreply email to GitHub login ([`f343bdff`](https://github.com/NousResearch/hermes-agent/commit/f343bdffbfde416773aa926b03ffd54debbf8675)) — @ethernet8023
- Map contributor email for ashmoonori-afk ([`6a1ee825`](https://github.com/NousResearch/hermes-agent/commit/6a1ee8255047d08c78f48076c5eb1b26dabc0282))
- **Plugins:** pin birkin-mnemosyne to core 0.7.1 ([`e216cd74`](https://github.com/NousResearch/hermes-agent/commit/e216cd746f9e6600cf40ab5622f5ad2119ef91cb)) — @ashmoonori-afk
- **Catalog:** review disclosure for huddo ([`85d27a51`](https://github.com/NousResearch/hermes-agent/commit/85d27a51cf87327f6ea894a3a78302a207706f34))
- Map contributor email for StudioCodeAI ([`c708b34f`](https://github.com/NousResearch/hermes-agent/commit/c708b34ff60cacbb2aa2a34d80e46febed1c2a1b))
- **Plugin-catalog:** update Telegram Client to 1.3.1 ([`27aaade9`](https://github.com/NousResearch/hermes-agent/commit/27aaade97b75cf8961be8201f167624b46454d8b)) — @guberm
- **Plugin-catalog:** bump Gmail to v1.0.20 ([`c6ac0565`](https://github.com/NousResearch/hermes-agent/commit/c6ac05655ca24c96c87ddd91d444f690ca9e621d)) — @guberm
- **Plugin-catalog:** bump Gmail to v1.0.19 ([`74324f11`](https://github.com/NousResearch/hermes-agent/commit/74324f11f4c3e6018f5d9fdaa575a06c66e2d464)) — @guberm
- **Plugin-catalog:** update Gmail to v1.0.18 ([`8050d9ea`](https://github.com/NousResearch/hermes-agent/commit/8050d9ea4cb12a3d68eaafbd2c05d57128d4a7e4)) — @guberm
- **Kiwi:** bump pin to kiwi@0.12.5, plugin v1.2.2 ([`a08f5894`](https://github.com/NousResearch/hermes-agent/commit/a08f5894355ac410a4af46875ff3ac47e8f89f50)) — @harrylabsj
- Map contributor email for dinosauria123 ([`06c81873`](https://github.com/NousResearch/hermes-agent/commit/06c8187384f21312d0e4c50b3297b7d3e14e1742))
- Lightningai-rate-limit to v1.1.0 (wall-clock aligned window) ([`e28d64e8`](https://github.com/NousResearch/hermes-agent/commit/e28d64e8b7b54258eae5c8cdc825f919421ca65a)) — @dinosauria123
- Map contributor email for TREE-Ind ([`71f78b3f`](https://github.com/NousResearch/hermes-agent/commit/71f78b3fe2a5b6be2dc219c999fc64ab44053b47))
- **Catalog:** review disclosure for hermes-aac ([`0567d017`](https://github.com/NousResearch/hermes-agent/commit/0567d017c46c3fdb9dd66d5468ad2ed96dc3cfc3))
- **Catalog:** review disclosure for openinvest ([`c179b286`](https://github.com/NousResearch/hermes-agent/commit/c179b286d448411f500c7318baf183769b6ba885))
- Map contributor email for Sahil-SS9 ([`d8b5bd8a`](https://github.com/NousResearch/hermes-agent/commit/d8b5bd8a497f7f3e8f02acf966b1be6afce2cd91))
- **Catalog:** review disclosure for hermes-agent-mixer ([`a98cc310`](https://github.com/NousResearch/hermes-agent/commit/a98cc310f913bb6e7ac27622fa105a433e415138))
- **Catalog:** review disclosure for hermes-activity ([`e891815c`](https://github.com/NousResearch/hermes-agent/commit/e891815c3ef35c1ba116bb4bb058594d3c4df2ec))
- Update Activity catalog to v0.2.0 ([`908c525d`](https://github.com/NousResearch/hermes-agent/commit/908c525dee4f28ba96617b4faa5e051bb21da2d7)) — @hassan-kamel
- Map contributor email for slchris ([`eaf08400`](https://github.com/NousResearch/hermes-agent/commit/eaf08400a6abd7dc2b1757ca5215dc41a9940c67))
- **Catalog:** showly reviewed disclosure + requires_hermes >=0.21.6 ([`2ee820e7`](https://github.com/NousResearch/hermes-agent/commit/2ee820e771033539a5d5eac8356c317af9979245))
- Map contributor email for Neboy72 ([`d9971f13`](https://github.com/NousResearch/hermes-agent/commit/d9971f131bcd4b2cb99523792cb8b43074fe91d0))
- **Catalog:** review disclosure for nexus ([`1a5f5c7b`](https://github.com/NousResearch/hermes-agent/commit/1a5f5c7b484f8ffccaa511ceb1639c3ce652e550))
- **Catalog:** review disclosure for kumiho-memory ([`63da5f7b`](https://github.com/NousResearch/hermes-agent/commit/63da5f7b2033d3969b825425937143cbc2168851))
- **Catalog:** review disclosure for model-router ([`92790c6d`](https://github.com/NousResearch/hermes-agent/commit/92790c6d79f0d743f532b9bf0c964bde6d893a29))
- **Catalog:** review disclosures for anatomy-museum, agent-janitor ([`560b2507`](https://github.com/NousResearch/hermes-agent/commit/560b250762a707ad355f3cd9019bff48be954d53))
- **Contributors:** map ieqzya@gmail.com to Ieqzya ([`c98162bb`](https://github.com/NousResearch/hermes-agent/commit/c98162bbb8473eac59d5a5ca7a4609ce2c828cca)) — @ethernet8023
- **Contributors:** map Darthvader88@gmail.com to guthixboss1 ([`8c5c9ac4`](https://github.com/NousResearch/hermes-agent/commit/8c5c9ac489232d1553208f2eff8dab79297bef70)) — @ethernet8023
- **Release:** pass the commit under test through every stable lane ([`66facf4a`](https://github.com/NousResearch/hermes-agent/commit/66facf4a57215c2a89d80c8c97c48acea46aa175)) — @ethernet8023

## 📦 Other Changes

- Repin hermes-insight to a61cdf6 (1.0.3) ([`0e427d78`](https://github.com/NousResearch/hermes-agent/commit/0e427d788d253630d38a3a51cd76849e73cd6925)) — @BrokeSkill
- Repin hermes-insight to afb08fb (1.0.2) ([`51e663da`](https://github.com/NousResearch/hermes-agent/commit/51e663da9def59da047d05cd88f8dd300fca75ed)) — @BrokeSkill
- Plugin-catalog: bump huddo to 0.9.0 ([`eeacc00a`](https://github.com/NousResearch/hermes-agent/commit/eeacc00ac0b6cfd25c7daee9709d428d3cc66213)) — @hellohanchen
- Plugin-catalog: re-pin hermes-lang-pt-br to 7548ff1 (pack verifier + CI) ([`82fbd41f`](https://github.com/NousResearch/hermes-agent/commit/82fbd41fd41998124a0ae15477306aba65ba6e29)) — @StudioCodeAI
- Plugin-catalog: re-pin hermes-lang-pt-br to 69efb2f (credits/timeline README) ([`2c20d9a3`](https://github.com/NousResearch/hermes-agent/commit/2c20d9a350a09c3cf36f3109d6fbf0e3431fde82)) — @StudioCodeAI
- Catalog: bump speechify to 0.1.1 ([`3a5b9e84`](https://github.com/NousResearch/hermes-agent/commit/3a5b9e84b15b3f6d878e40045e2b26f170415759)) — @Lokeshm24
- Catalog: re-pin qdrant-memory to 0.2.1 (e14adc06) ([`720552bb`](https://github.com/NousResearch/hermes-agent/commit/720552bb3083aa7a68087ee98b46b52214fbecc9)) — @cnkang
- Catalog: repin Hermes AAC 0.1.1 SDK-only reduced features ([`473e2847`](https://github.com/NousResearch/hermes-agent/commit/473e284730b8047d1623f038bafd94c77da2f124)) — @TREE-Ind
- Plugin-catalog: openinvest re-pin to 106e5ba (bounded backend deps, 0.41.6) ([`6cc9a434`](https://github.com/NousResearch/hermes-agent/commit/6cc9a4347b351ca6d4f4b084e572322c9d6f824c)) — @longsizhuo
- Plugin-catalog: openinvest re-pin to 3a0c816 (review fixes, backend 0.41.4) ([`00c311c8`](https://github.com/NousResearch/hermes-agent/commit/00c311c834c0184f5eecc36635e8abc0e665dbf9)) — @longsizhuo
- Plugin-catalog: openinvest re-pin to 3e1a9d7 (review fixes) ([`cb223633`](https://github.com/NousResearch/hermes-agent/commit/cb223633d2d8dc84782254563d32902d4213a943)) — @longsizhuo
- Plugin-catalog: bump plan-mode to 0.4.4 ([`2a5617f8`](https://github.com/NousResearch/hermes-agent/commit/2a5617f858a22ab852ee0332460e164af8bbbc3a)) — @100yenadmin
- Plugin-catalog: bump plan-mode to 0.4.3 ([`6fafdd4f`](https://github.com/NousResearch/hermes-agent/commit/6fafdd4f06b35ec4e09adccf6769b547a470ac69)) — @100yenadmin
- Catalog: pin the Showly community plugin ([`5da3156c`](https://github.com/NousResearch/hermes-agent/commit/5da3156c8607f15206de74b22a69a015c073d09e)) — @slchris
- Catalog(nexus): repin the sha to 4392e6d — /embed and /mcp demand a per-installation key ([`64425a06`](https://github.com/NousResearch/hermes-agent/commit/64425a0663de5e2d660b498013a9a89a4b68f920)) — @Neboy72
- Catalog(nexus): repin to v0.22.24 — the embedder comes from the service, not from a shadowed path ([`0ee11795`](https://github.com/NousResearch/hermes-agent/commit/0ee11795cfff24a44f17a5bccf9cb7c984b17360)) — @Neboy72
- Catalog(nexus): repin to v0.22.23 — the plugin reaches its own venv again ([`a442c9a5`](https://github.com/NousResearch/hermes-agent/commit/a442c9a57732ef7f8aa025d17dd9d87554b6d511)) — @Neboy72
- Catalog(nexus): pin the engine to the full sha of the reviewed commit ([`1f295ae0`](https://github.com/NousResearch/hermes-agent/commit/1f295ae0fff2bc895a744eade123bd8e08c11397)) — @Neboy72
- Catalog(nexus): repin to v0.22.22 — the engine rev is one resolvable tag, the docs match the code ([`7f495184`](https://github.com/NousResearch/hermes-agent/commit/7f495184c433fcc7eaea2b9dc61b7bd039b81b0a)) — @Neboy72
- Catalog(nexus): repin to v0.22.21 — five access-level gaps closed ([`0f8a2a17`](https://github.com/NousResearch/hermes-agent/commit/0f8a2a1767c68bace57ac176e95058f4e58d7e82)) — @Neboy72
- Catalog(nexus): repin to v0.22.20 — conversation history is private ([`14aaf8e1`](https://github.com/NousResearch/hermes-agent/commit/14aaf8e12c1b4daf9bbae42242d9900e10cf61c1)) — @Neboy72
- Catalog(nexus): repin to v0.22.18 (Claude Code writes memory again) ([`2165eed9`](https://github.com/NousResearch/hermes-agent/commit/2165eed96be42a4b4165b159bf6573d50a610ebf)) — @Neboy72
- Catalog(nexus): repin to v0.22.17 (memory provider can embed again) ([`f60e16fc`](https://github.com/NousResearch/hermes-agent/commit/f60e16fced7a111d247b7ee7cec8787c8c9d5222)) — @Neboy72
- Catalog(nexus): repin to v0.22.16 (named-vector fixes in the root package) ([`dab47696`](https://github.com/NousResearch/hermes-agent/commit/dab47696a5915f3c4170c9c0c0ceb87b55294d50)) — @Neboy72
- Catalog(nexus): repin to v0.22.15 (review findings: stricter trust matching) ([`3952f2b5`](https://github.com/NousResearch/hermes-agent/commit/3952f2b527920451f33c6971ee39b92c9ab6f108)) — @Neboy72
- Catalog(nexus): repin to 3f77b2a (plugin.yaml version parity) ([`ca1c2261`](https://github.com/NousResearch/hermes-agent/commit/ca1c22617558e74d6bbf49b0832cd4cdb4ef3a52)) — @Neboy72
- Catalog(nexus): repin to v0.22.13 (named collection model) ([`c7b035c1`](https://github.com/NousResearch/hermes-agent/commit/c7b035c1f1edf8ab241f7bacdd70e031ebb3d783)) — @Neboy72
- Plugin-catalog: bump account-pool to 4.0.2 ([`e5d2cebe`](https://github.com/NousResearch/hermes-agent/commit/e5d2cebe17e94a3bba69867a8127d98bdf2cc05b)) — @roqianjas
- Plugin-catalog: bump alans-way and alans-way-computer to 0.21.5 ([`a8d61e30`](https://github.com/NousResearch/hermes-agent/commit/a8d61e309fc8e7f22e7e4c9e3a48a11fb1f19a47)) — @capthvnsen
- Plugin-catalog: bump tinyfish to 0.2.2 ([`6ebd92d9`](https://github.com/NousResearch/hermes-agent/commit/6ebd92d93852b7f33ca3bdb2c6c3d0fc997ce46f)) — @Zechereh
- Plugin-catalog: nvidia pins -> de75692 (Broadcast troubleshooting uses tool_search, not a shell probe) ([`66cd37c9`](https://github.com/NousResearch/hermes-agent/commit/66cd37c997fcc63423dfefbd5202e121641f49ca)) — @alt-glitch
- Plugin-catalog: nvidia-app + nvidia-broadcast pin -> 729e25c (first-run setup when the app side is not ready) ([`f18948e4`](https://github.com/NousResearch/hermes-agent/commit/f18948e4cdc88b38104c0c4572dd8f00269c3eed)) — @alt-glitch
- Catalog: agent-janitor (from #137875) ([#137875](https://github.com/NousResearch/hermes-agent/pull/137875)) — @ZidoCode
- Catalog: anatomy-museum (from #138166) ([#138166](https://github.com/NousResearch/hermes-agent/pull/138166)) — @danrudy33
- Catalog: secure-env-ingress (from #132272) ([#132272](https://github.com/NousResearch/hermes-agent/pull/132272)) — @web3blind

## 👥 Contributors

Thank you to everyone who contributed to this release!

- @ethernet8023 (33 commits)
- @kshitijk4poor (17 commits)
- @Neboy72 (13 commits)
- @elisam0 (7 commits)
- @guberm (4 commits)
- @longsizhuo (4 commits)
- @helix4u (3 commits)
- @j-nolan (3 commits)
- @StudioCodeAI (3 commits)
- @TakeshiTGAL (3 commits)
- @olric3015 (3 commits)
- @sin5ddd (2 commits)
- @xxxigm (2 commits)
- @rroverin (2 commits)
- @BrokeSkill (2 commits)
- @2867297362mjb-sketch (2 commits)
- @dinosauria123 (2 commits)
- @TREE-Ind (2 commits)
- @100yenadmin (2 commits)
- @Sahil-SS9 (2 commits)
- @hassan-kamel (2 commits)
- @slchris (2 commits)
- @alt-glitch (2 commits)
- @Ieqzya (2 commits)
- @emozilla (1 commit)
- @predatorheard-byte (1 commit)
- @Oceanswave (1 commit)
- @nv-pberard (1 commit)
- @dandacompany (1 commit)
- @ashmoonori-afk (1 commit)
- @hellohanchen (1 commit)
- @Lokeshm24 (1 commit)
- @harrylabsj (1 commit)
- @cnkang (1 commit)
- @kaveone (1 commit)
- @roqianjas (1 commit)
- @capthvnsen (1 commit)
- @Zechereh (1 commit)
- @metamindedu (1 commit)
- @ZidoCode (1 commit)
- @danrudy33 (1 commit)
- @web3blind (1 commit)
- @smfworks (1 commit)
- @jarvistwil (1 commit)
- @guthixboss1 (1 commit)
- @chelsealong (1 commit)
- @dwaxe (1 commit)
- @KoNit-K (1 commit)
- @sajidhaleem (1 commit)

## Updating

- CLI and installer-script desktop installs: `hermes update`, or re-run the installer one-liner. This moves installs that took v0.22.1 back onto the release line.
- Microsoft Store: updates through the Store.
- Docker / Hermes Cloud: `nousresearch/hermes-agent:stable` (or `:latest`).

**Full Changelog**: [v0.22.0...v0.22.2 (release line)](https://github.com/NousResearch/hermes-agent/compare/v0.22.0...4ccc58062c0db3010520d7dfd49e869ef74a8e89)
