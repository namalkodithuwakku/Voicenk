# VoiceNK Contacts + Profile Update

This is a focused update package. It does not replace unrelated working files.

## Included

- Incoming contact requests: Accept / Decline
- Outgoing pending requests: Pending / Cancel
- Accepted contacts list for both users
- Contacts can open/start their one-to-one chat
- Recent chats remain separate
- Edit Profile: display name, custom VoiceNK ID, language, voice preview/selection, Visible/Invisible
- Same-language messages skip translation and translated TTS
- Different-language messages use the sender's selected translated voice

## Installation order

1. Commit or back up the current working project.
2. Run `supabase/migrations/004_contacts_profile_privacy.sql` in the correct Supabase project.
3. Copy this package over the project and replace matching files only.
4. Run:

```bash
npm run lint
npm run build
```

5. Test with two accounts before pushing.

## Required tests

1. User A sends User B a request.
2. User A sees it under Sent Requests.
3. User B sees it under Incoming Requests.
4. User B accepts it.
5. Both users see each other under Contacts.
6. Contact opens the chat.
7. Same-language message plays the original recording without translation.
8. Different-language message translates and uses the sender's selected voice.
9. Set a profile Invisible and verify it disappears from new searches.
10. Existing contact/chat still works while Invisible.

## Voice choices

- Male voice: `cedar`
- Female voice: `marin`
- Neutral voice: `sage`

Voice cloning is intentionally postponed.
