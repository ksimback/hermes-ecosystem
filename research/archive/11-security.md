# Hermes Agent — Security

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/security

## Seven-Layer Defense-in-Depth

1. User authorization (allowlists, DM pairing)
2. Dangerous command approval (human-in-the-loop)
3. Container isolation (Docker/Singularity/Modal)
4. MCP credential filtering
5. Context file scanning (prompt injection detection)
6. Cross-session isolation
7. Input sanitization

## Dangerous Command Approval

Modes: manual (default), smart (LLM risk assessment), off (--yolo).

Patterns detected: rm -r, chmod 777, DROP TABLE, DELETE without WHERE, curl|sh, pkill hermes, and more.

## Container Security

Docker runs with: dropped ALL capabilities, no-new-privileges, PID limit 256, size-limited tmpfs, namespace isolation.

## SSRF Protection

Blocks private networks, loopback, link-local, cloud metadata, CGNAT. DNS failures = blocked (fail-closed).

## Tirith Pre-Exec Scanning

Detects homograph URL spoofing, pipe-to-interpreter patterns, terminal injection. SHA-256 verified binary.

## Context File Injection Protection

Scans for: "ignore previous instructions", hidden HTML, credential exfiltration, invisible Unicode.
