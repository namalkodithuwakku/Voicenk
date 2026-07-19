# VoiceNK v1 Final Setup

1. Run `supabase/migrations/002_messaging.sql` in Supabase SQL Editor.
2. Confirm the private `voice-messages` bucket exists.
3. Keep all current Vercel variables, including Supabase, OpenAI and `NEXT_PUBLIC_SITE_URL`.
4. Redeploy after running lint and build.

## Final v1 core flows

- Interpreter: Tap → Record → Stop → Edit → Translate → Play.
- Messaging: Tap → Record → Stop → Edit → Send.
- Search by name or @VoicenkID.
- Contact request acceptance creates a private one-to-one conversation.
- Incoming bubbles show translated text first; original expands on demand.
- Translated voice is generated only when Play is tapped to reduce AI cost.
