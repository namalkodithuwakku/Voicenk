# Voicenk Architecture v1

## Product model

Voicenk contains two primary user modes:

1. **Messages** — asynchronous multilingual voice communication between Voicenk users.
2. **Interpreter** — face-to-face multilingual communication using one device.

Both modes will eventually share a conversation-oriented domain model.

## Frontend

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS v4
- Feature-based modules
- Mobile-first UI
- Server components by default
- Client components only where interaction is required

## Planned backend

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Server-side AI orchestration through Next.js route handlers

## Planned voice pipeline

1. Capture audio
2. Upload or stream securely
3. Speech recognition
4. Language detection
5. Context-aware translation
6. Text-to-speech
7. Deliver translated audio and text

## Core rule

AI secrets and provider keys must never be exposed in browser code.


## Package 03 interpreter implementation

The current MVP uses a request-based pipeline rather than realtime audio:

- Browser MediaRecorder
- Next.js server route
- OpenAI audio transcription
- OpenAI text translation
- OpenAI text-to-speech
- MP3 returned as base64 for immediate playback

This is intentional for the first reliable version. Realtime speech-to-speech
can be evaluated later without replacing the core conversation domain.
