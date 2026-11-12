# Hermes Agent — FAQ & Troubleshooting

**Source:** https://hermes-agent.nousresearch.com/docs/reference/faq

## Key FAQ

- **Providers:** Works with any OpenAI-compatible API. 18+ providers supported.
- **Windows:** Not natively. Use WSL2.
- **Privacy:** No telemetry. Conversations stored locally in ~/.hermes/.
- **Offline/Local:** Yes, via Ollama, vLLM, llama.cpp, SGLang.
- **Cost:** Free and open-source (MIT). Pay only for LLM API usage.
- **Multi-user:** Yes, via messaging gateway with allowlists and DM pairing.
- **Memory vs Skills:** Memory = facts. Skills = procedures.
- **Python Library:** Import AIAgent directly.
- **Profiles:** Managed layer on HERMES_HOME. Isolated config, sessions, skills, memory per profile. No hard limit on count.
