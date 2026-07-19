# OpenAI Setup — Package 03

## 1. Create an API key

Create an API key in the OpenAI Platform dashboard.

Do not paste the key into browser code, GitHub, screenshots, or any
`NEXT_PUBLIC_` environment variable.

## 2. Add the key locally

Open `.env.local` in the project root and add:

```env
OPENAI_API_KEY=your-secret-api-key
```

Optional model overrides:

```env
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_TRANSLATE_MODEL=gpt-5-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
```

## 3. Restart the development server

```bash
npm run dev
```

## 4. Vercel

Before deploying, add the same server-only `OPENAI_API_KEY` in:

**Vercel project → Settings → Environment Variables**

Never prefix it with `NEXT_PUBLIC_`.

## Current pipeline

1. Browser records up to 30 seconds.
2. Audio is posted to the server route.
3. Server transcribes it.
4. Server translates the transcript.
5. Server generates translated MP3 speech.
6. Browser displays both texts and plays the translated voice.

## Cost safeguards included

- 30-second client recording limit
- 12 MB server upload limit
- 4,096-character TTS limit
- Server-only key
- One processing request per recording
- Previous in-flight requests are cancelled when a new one starts

For public release, add authenticated usage quotas, IP/device rate limits, and
abuse monitoring before offering unlimited access.
