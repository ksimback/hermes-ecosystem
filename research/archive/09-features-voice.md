# Hermes Agent — Voice Mode

**Source:** https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode

## Modes

| Feature | Platform | Description |
|---------|----------|-------------|
| Interactive Voice | CLI | Ctrl+B to record, auto-silence detection |
| Auto Voice Reply | Telegram, Discord | Audio with text responses |
| Voice Channel | Discord | Bot joins VC, listens, speaks |

## STT Providers

Local (faster-whisper), Groq, OpenAI. Auto-fallback: local > groq > openai.

## TTS Providers

Edge TTS (free), ElevenLabs (paid, excellent), OpenAI TTS (paid), NeuTTS (free, local).

## Features

- Streaming TTS (sentence-by-sentence as text generates)
- Whisper hallucination filter (26 known phrases)
- Echo prevention in Discord voice channels
- Two-stage silence detection algorithm
