# VoiceNK — Live Language, Voice-Only & Delete Account Update

This is an overlay update. Do not replace the entire project folder.

## Included behavior

### Live profile language

- Saving a new preferred language refreshes the signed-in profile immediately.
- Messages and contacts listen for profile updates through Supabase Realtime.
- Open chats refresh the contact profile and use the new language for future messages.
- Existing messages are not rewritten.

### Same-language messaging

When both profiles use the same preferred language:

- no transcription request
- no translation request
- no generated AI voice
- the original recording is uploaded and sent
- playback uses the original recording

When languages differ, the existing transcript/edit/translate flow remains active.

### Delete account

The Me screen includes a guarded Delete account option. The user must type `DELETE`.
The server removes the user's owned voice files and then deletes the Supabase Auth user.
Related profile/contact/membership rows are removed through existing foreign-key cascades.

## 1. Backup

```bash
git add .
git commit -m "backup: before live language and account deletion update"
git push
```

## 2. Run the migration

In Supabase SQL Editor run:

`supabase/migrations/005_live_language_voice_only_delete.sql`

The migration only:

- allows transcript fields to be null for same-language voice-only messages
- adds `profiles` and `messages` to Supabase Realtime when missing
- reloads the Data API schema

## 3. Add the server secret

In Supabase open **Project Settings → API Keys** and copy the **Secret key**.

Add it locally to `.env.local`:

```env
SUPABASE_SECRET_KEY=your_secret_key
```

Add the same variable in:

**Vercel → VoiceNK → Settings → Environment Variables**

Name:

```text
SUPABASE_SECRET_KEY
```

Apply it to Production and Preview.

Never prefix this value with `NEXT_PUBLIC_`. Never expose it in frontend code.

## 4. Copy the files

Copy the files in this ZIP to the matching paths in the VoiceNK project and replace matching files only.

Do not replace or delete:

- `.git`
- `.env.local`
- `node_modules`
- `.next`

## 5. Test locally

```bash
cd /d "E:\NK Labs\Voicenk"
npm run lint
npm run build
npm run dev
```

### Two-account tests

1. Set both accounts to the same language.
2. Send a voice message.
3. Confirm VoiceNK shows `Voice message ready` immediately after stopping.
4. Confirm no transcription or translation is requested.
5. Play the received message and confirm the original recording is used.
6. Change one account to a different language.
7. Keep the chat open on the other account.
8. Confirm the contact language refreshes without logging out.
9. Send another message and confirm transcript/edit/translation returns.
10. Open Me → Delete account only on a disposable test account.
11. Type DELETE and confirm the account is removed and returned to guest mode.

## 6. Push

```bash
git add .
git commit -m "feat: add live language voice-only messaging and account deletion"
git push
```
