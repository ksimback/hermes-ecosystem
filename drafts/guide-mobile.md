# Hermes Mobile: your agent, away from your desk

Published November 13, 2026. Updated November 14, 2026 with Alex Finn’s November 11 beta walkthrough; official access page rechecked November 14.

Start here: the official [Hermes Mobile page](https://hermes-agent.nousresearch.com/mobile) currently offers an iOS and Android beta waitlist, not a guaranteed immediate download. If you need phone access now, Nous also documents opening a Cloud agent in your phone’s browser. That is a separate route, not admission to the native beta.

[← All Hermes guides](/guide/) · [Choose your setup](/guide/modes/) · [Desktop guide](/guide/desktop/)

[What it is](#what)[Get access](#access)[Choose a backend](#backend)[Feature tour](#tour)[Useful workflows](#workflows)[Safety and troubleshooting](#security)

## 1. What Hermes Mobile actually is

Hermes Mobile is Nous Research’s official iPhone and Android companion app for Hermes Agent. Think of it as a control surface for your agent: a place to open conversations, inspect work, review files, and manage capabilities while the agent’s backend does the execution.

The important distinction is phone interface versus agent runtime. Tonbi’s beta tour connects to a remote machine; Nous’s Cloud offering runs a hosted agent in its own container. Neither is evidence that the full agent or its model runs locally on your phone. Your files, tools, credentials, and persistence depend on the backend and profile you select. [[Video: backends]](https://www.youtube.com/watch?v=7hbT1EzTquI&t=301s) [[Nous: Cloud]](https://x.com/NousResearch/status/2119851439904510217)

A useful mental model: the phone is where you direct and review work; the backend is where the work happens. A disconnected phone is not the same as a stopped backend, although beta reconnection and background behavior should not be assumed flawless.

## 2. Get the right app, not a lookalike

Nous launched the mobile beta at NousCon in late October. On November 3, it said the beta had filled quickly and directed people to the waitlist while it worked toward wider availability. The current official page still uses that waitlist. No general-release date was established in the sources reviewed. [[Nous announcement]](https://x.com/NousResearch/status/2117696344756252822)

- Open [the official mobile page](https://hermes-agent.nousresearch.com/mobile) and select your platform.
- Follow the current enrollment or invitation instructions. The beta has used TestFlight for iOS and Firebase App Distribution for Android; old invitation links are not a reliable access path.
- Check the publisher and invitation provenance before installing or entering credentials. Nous has specifically warned about apps that imitate Hermes branding. [[Official warning]](https://x.com/NousResearch/status/2114340383044063552)

Also distinguish the official app from the community [hermes-mobile adapter](https://hermes-agent.nousresearch.com/marketplace/hermes-mobile). That plugin gives developers a WebSocket interface for their own clients. Its installation commands, token variables, and port are not a verified setup recipe for Nous’s native app. Separately labeled community clients can be legitimate without being official.

## 3. Choose where your agent lives

### Option A: Nous Cloud

This is the lower-maintenance route. Nous’s November 9 announcement says to choose an agent name and model in [Nous Portal](https://portal.nousresearch.com/cloud), then open the agent in the Webapp from your phone. It says Plus, Super, and Ultra each include one Cloud agent, hosted around the clock. Check current plan terms before subscribing; hosting entitlement does not establish unlimited model or third-party tool usage. [[Source]](https://x.com/NousResearch/status/2119851439904510217)

Useful while waiting: this phone-browser route does not require a native-beta invitation. It is not the same interface-distribution mechanism as installing the mobile app.

### Option B: your own computer or server

Tonbi’s beta shows gateway-address and SSH/Mosh connection options, and a terminal connected to his remote machine. That establishes what his build exposed, not a universal onboarding flow. Complete current native-app setup documentation was not found, so follow the instructions supplied with your invitation rather than guessing ports or installing unrelated adapters.

Prepare a running backend, configured model access, supported authentication, and a secure route from your phone to the host. A sleeping laptop cannot serve as an always-available agent. Prefer a trusted VPN or tunnel and proper authentication over exposing a powerful service directly to the internet.

### A documented self-hosted browser alternative

The official Desktop documentation separately describes serving its workspace through the gateway:

```bash
hermes config set webapp.enabled true
hermes gateway restart
hermes webapp
```

These are Webapp commands, not native-mobile pairing commands. The documented default is host-local 127.0.0.1:9120; typing that address on a phone points at the phone itself. Remote access needs the documented networking and authentication setup. Use HTTPS for remote browser features such as microphone access. [[Official Webapp guide]](https://hermes-agent.nousresearch.com/docs/user-guide/desktop#use-the-desktop-workspace-from-a-browser)

## 4. Make your first session deliberately boring

Before connecting sensitive accounts or scheduling work, verify the basics with a harmless request:

“Tell me which profile and working directory this session uses. Do not read secrets, change files, or contact external services.”

Then ask it to create a small sample note in a clearly specified scratch folder and confirm you can inspect the resulting artifact. Check the selected model, workspace, and tool activity. Start a second session only after the first behaves as expected. Separate profiles and group chats are not a substitute for OS-level isolation or account permissions.

## 5. What the beta puts on your phone

Tonbi’s [7-minute tour](https://www.youtube.com/watch?v=7hbT1EzTquI) is a useful map of the app. The following are attributed beta observations, not a promise of identical screens or feature parity in every build:

- Agents and sessions. Browse named profiles and their recent conversations, inspect session settings, and see the working folder. Later in the tour, a second chat runs while the first agent continues working. [0:55](https://www.youtube.com/watch?v=7hbT1EzTquI&t=55s) · [6:10](https://www.youtube.com/watch?v=7hbT1EzTquI&t=370s)

- Terminal, routines, and artifacts. The tour shows a remote SSH terminal, existing scheduled jobs, and a gallery of generated documents, code, and images. A file appearing as an artifact does not mean it has been deployed or published. [1:53](https://www.youtube.com/watch?v=7hbT1EzTquI&t=113s)

- Files, skills, and integrations. Browse backend files, inspect installed skills, explore the skill hub, and see Connections, Plugins, and MCP controls. Tonbi’s Stripe and Slack connections belong to his configured account, not every installation. [2:48](https://www.youtube.com/watch?v=7hbT1EzTquI&t=168s)

- Kanban and customization. Inspect a task board, add a task, change agent appearance, and see agent-creation controls. Tonbi explicitly says he has not explored Kanban deeply; this is not a tested autonomous-board tutorial. [3:39](https://www.youtube.com/watch?v=7hbT1EzTquI&t=219s)

- Portal and backend settings. Manage the connected account, follow Cloud links, and inspect backend options. Keep plan management separate from the credentials and permissions of individual tools. [4:28](https://www.youtube.com/watch?v=7hbT1EzTquI&t=268s)

- Tool and subagent visibility. The example opens details of a loaded skill and later shows a delegated task. This makes mobile useful for checking what an agent is doing, not merely sending prompts. [5:32](https://www.youtube.com/watch?v=7hbT1EzTquI&t=332s) · [7:03](https://www.youtube.com/watch?v=7hbT1EzTquI&t=423s)

### A second beta walkthrough: sessions, model choice, and home hardware

Alex Finn’s [November 11 walkthrough](https://www.youtube.com/watch?v=f_NfbjaSJ-k) adds a closer look at how he uses the app day to day. These are observations from his configured beta, not a setup or feature-parity guarantee for every build.

- **One agent, separate conversations.** He opens distinct sessions under the same agent for different projects. Use one session per task or idea instead of feeding unrelated work into one growing thread. Profiles choose the configured agent; sessions separate its conversations. [1:56](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=116s) · [5:14](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=314s)
- **Model controls on the phone.** His settings show favorite and all-model lists, model switching, skill toggles, and agent-creation controls for the name and SOUL. Available models depend on backend providers, credentials, and capacity. [2:32–3:54](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=152s)
- **A memory-graph view.** He opens a map of connected memories. This does not establish identical graph or editing support for every memory provider on mobile. [3:17](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=197s)
- **Local models, remotely accessed.** Finn describes an agent backed by models on his own DGX Spark hardware—not on his phone. This is an alternative to hosted inference, not unlimited free computing: hardware, power, capacity, and connectivity still matter. [0:59](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=59s) · [6:38](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=398s) · [Official local-model docs](https://hermes-agent.nousresearch.com/docs/user-guide/local-models)
- **Remote computer errands.** He reports requesting app installation and configuration across his connected computers. These are creator-reported outcomes, not independently verified one-click setup. Establish host access and permissions; review the target, plan, and changes before authorizing installs or deletions. [7:06–9:17](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=426s)

**Where it fits:** capture a task in its own session and check backend work away from a desk. Finn keeps other tools for deeper work; that is his preference, not a benchmark. His free/wider-release predictions are not confirmed by the official access page, which still shows a beta waitlist when checked November 14. [10:41](https://www.youtube.com/watch?v=f_NfbjaSJ-k&t=641s) · [Official access page](https://hermes-agent.nousresearch.com/mobile)

### Voice: dictation is not the same as Live Mode

The tour identifies voice dictation and a Live Mode control. Crucially, the creator says Live Mode is not configured in his demonstration. Do not infer tested pause-to-send timing, lock-screen listening, offline transcription, or always-on conversation from that menu. Voice may depend on microphone permission and backend speech-provider configuration. [[Video]](https://www.youtube.com/watch?v=7hbT1EzTquI&t=117s) [[General Hermes voice docs]](https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode)

## 6. Understand skills, connections, plugins, and MCP

- Skills are reusable procedural knowledge the agent can load. They do not, by themselves, authorize an external account.
- Connections link accounts and grant access to services. Review the requested scopes before authorizing.
- Plugins extend the agent with executable capabilities or integrations.
- MCP servers expose tools to the backend through a standard protocol. Seeing an MCP control on a phone does not mean the server runs on the phone.

Composio offers one optional route to external apps through its MCP-compatible Connect service, with browser-based account authorization. Its [public Connect documentation](https://docs.composio.dev/docs/composio-connect) and [Hermes troubleshooting guide](https://docs.composio.dev/kb/guide/mcp-mcp-hermes) are useful integration references. There is no verified basis here to claim the official mobile app’s Connections screen is specifically powered by Composio, or that installing it is required.

Connect only what a workflow needs. Reading a calendar, sending an email, changing a billing record, and posting publicly are different permissions and should have different approval boundaries. [[Skills]](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) [[MCP]](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)

## 7. Three workflows worth starting with

### Prepare for a meeting

“Using only the documents I attach, give me the decisions needed, unresolved questions, and three things to ask. Do not message anyone or modify the originals.”

### Review work already in progress

“Show me the latest draft artifact from this session. Summarize what changed and what was actually verified. Do not publish, deploy, or merge anything.”

### Set a recurring research brief

“Propose a weekday 8 AM America/Puerto_Rico brief on these three topics. Show the schedule, sources, and delivery destination before creating it.”

After reviewing the proposal, explicitly authorize creation, inspect the saved routine, and test delivery. Hermes routines are backend jobs, not phone alarm-clock reminders. The gateway must stay running, the destination must be configured, and each run can consume model or tool usage. [[Scheduling docs]](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)

## 8. Safety, limits, and quick troubleshooting

- Connection fails? Check host availability, network/VPN reachability, authentication, and backend compatibility before changing security settings. A mobile session cannot fix a powered-off server.
- Voice fails? Distinguish a missing microphone permission from missing speech configuration. In a remote browser, check HTTPS as well.
- A routine never arrives? Check the saved timezone, enabled state, running gateway, and exact delivery channel. Do not assume an unconnected messaging account can receive it.
- Tool missing or integration denied? Check the active profile, installation/activation state, account authorization, and permitted tool scopes. Do not “fix” it by granting blanket access.
- Forgotten data still exists? Review backend memory, session history, backups, and external service retention separately. A phone UI does not make those copies disappear.
- Costs seem unclear? Separate agent hosting, model usage, paid tools, speech services, and external subscriptions. No native-app price or all-inclusive usage guarantee was verified for this guide.

Treat backend access like access to a powerful computer account. The official Webapp security guidance warns that a signed-in user can run commands, use files, and reach the host account’s environment and credentials. Protect your phone, avoid sharing credentials or public screenshots containing secrets, and require approval before destructive changes or external writes.

Bottom line: Hermes Mobile is most useful as a way to direct, inspect, and approve backend work while away from a desk. Start with one profile and one read-only workflow, then add accounts, automation, and delegation only when you understand where execution and data actually live.

## Sources and verification notes

Additional source: [Alex Finn: The Hermes Mobile App is AWESOME](https://www.youtube.com/watch?v=f_NfbjaSJ-k), November 11, 2026; 13:43; English auto-generated captions reviewed November 14. Uncertain model names and competitive exclusivity claims were not treated as verified facts.

This guide combines the video’s recovered public transcript, first-party Nous announcements, current official documentation, and Composio’s public docs. No native app was installed or independently exercised. Beta UI observations are attributed rather than presented as current setup guarantees.

- [Tonbi’s AI Garage: Hermes Mobile App Sneak Peek](https://www.youtube.com/watch?v=7hbT1EzTquI), November 3, 2026; public transcript and chapter links.
- [Official Hermes Mobile beta waitlist](https://hermes-agent.nousresearch.com/mobile), checked November 12, 2026.
- [Nous Research: beta capacity and waitlist](https://x.com/NousResearch/status/2117696344756252822), November 3.
- [Nous Research: Cloud agents in a phone browser](https://x.com/NousResearch/status/2119851439904510217), November 9.
- [Nous Research: impersonator-app warning](https://x.com/NousResearch/status/2114340383044063552), October 25.
- [Official Desktop and Webapp documentation](https://hermes-agent.nousresearch.com/docs/user-guide/desktop), plus the skills, MCP, voice, and scheduling references linked above.
- [Composio Connect documentation](https://docs.composio.dev/docs/composio-connect) and [Hermes MCP troubleshooting](https://docs.composio.dev/kb/guide/mcp-mcp-hermes).
