# Voicenk

**Universal Voice Messenger**

## Package 03 — Interpreter MVP

This package adds a working guest-access interpreter:

- Hold to record
- Release to process
- Source and target language selection
- Auto-detect source option
- Language switching
- Speech transcription
- Context-aware translation
- Generated translated voice
- Automatic playback
- Replay, stop and record-again flows
- Microphone and API error handling
- 30-second recording safeguard

## Install

Copy Package 03 over Package 02 while preserving:

- `.git`
- `.env.local`

Then run:

```bash
npm install
npm run dev
```

## Required setup

Complete:

- `docs/SUPABASE_SETUP.md`
- `docs/OPENAI_SETUP.md`

## Validate

```bash
npm run lint
npm run build
```

Use `docs/INTERPRETER_TESTING.md` for the complete test checklist.
