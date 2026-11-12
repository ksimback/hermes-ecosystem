# Hermes Agent — Messaging Gateway

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging

## Overview

Single background process connecting all configured platforms, handling sessions, cron jobs, voice messages.

## Supported Platforms (14)

Telegram, Discord, Slack, WhatsApp, Signal, SMS, Email, Home Assistant, Mattermost, Matrix, DingTalk, Feishu/Lark, WeCom, Webhooks

## Setup

```bash
hermes gateway setup     # Interactive
hermes gateway install   # Install as service
hermes gateway start     # Start service
```

## Session Reset Policies

- Daily: Reset at specific hour (default 4 AM)
- Idle: Reset after N minutes inactivity (default 1440)
- Both: Whichever triggers first

## Security

Default deny-all. Authorization via allowlists or DM pairing. Pairing codes: 8-char, crypto-random, 1-hour TTL, rate-limited.

## Chat Commands (25+)

/new, /model, /provider, /personality, /retry, /undo, /status, /stop, /approve, /deny, /sethome, /compress, /title, /resume, /usage, /insights, /reasoning, /voice, /rollback, /background, /reload-mcp, /update, /help
