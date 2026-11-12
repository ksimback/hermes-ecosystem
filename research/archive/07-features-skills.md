# Hermes Agent — Skills System

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/skills

## Overview

Skills are on-demand knowledge documents using progressive disclosure (3-level token-efficient loading). Follow agentskills.io open standard.

## Usage

Every skill is a slash command: `/gif-search funny cats`, `/axolotl help me fine-tune`, `/plan design a rollout`

## Progressive Disclosure

- Level 0: skills_list() → name/description/category (~3k tokens)
- Level 1: skill_view(name) → full content + metadata
- Level 2: skill_view(name, path) → specific reference file

## SKILL.md Format

Standard frontmatter with name, description, version, platforms, metadata (tags, category, config). Body has When to Use, Procedure, Pitfalls, Verification sections.

## Agent-Managed Skills (skill_manage tool)

Agent creates/patches/edits/deletes skills as procedural memory. Triggered after complex tasks (5+ tool calls), errors resolved, or user corrections.

## Skills Hub

Browse, search, install from multiple registries:

| Source | Type |
|--------|------|
| official | Optional skills shipped with Hermes |
| skills-sh | Vercel's skills.sh directory |
| well-known | URL-based /.well-known/skills/index.json |
| github | Direct GitHub repo installs + taps |
| clawhub | Third-party marketplace |
| claude-marketplace | Claude-compatible manifests |
| lobehub | LobeHub public catalog |

## Default Taps

- openai/skills
- anthropics/skills
- VoltAgent/awesome-agent-skills
- garrytan/gstack

## Security

All hub skills undergo scanning for data exfiltration, prompt injection, destructive commands, supply-chain threats. Trust levels: builtin > official > trusted > community.
