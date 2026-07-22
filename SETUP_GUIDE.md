# VoiceNK Push Notifications Setup

This package adds background push notifications for new voice messages.

## What it does

- Registers a Web Push subscription after the signed-in user approves notifications.
- Saves the browser subscription in Supabase.
- Uses a service worker to display notifications while VoiceNK is closed or backgrounded.
- Uses a Supabase Database Webhook to call the secure VoiceNK notification endpoint whenever a new message is inserted.
- Does not place transcript or translation text in the notification.
- Notification text is only: `New voice message from <name>`.

## 1. Back up VoiceNK

From:

```text
E:\NK Labs\Voicenk
```

run:

```bash
git add .
git commit -m "backup: before push notifications"
git push
```

## 2. Run the SQL now

Yes, run this migration before copying the frontend files:

```text
supabase/migrations/006_push_notifications.sql
```

Open Supabase → SQL Editor → New query, paste the complete migration and run it.

Expected result: success or “No rows returned.”

Verify:

```sql
select
  id,
  user_id,
  endpoint,
  enabled,
  created_at
from public.push_subscriptions;
```

Zero rows is normal until a user enables notifications.

## 3. Install dependencies

Run:

```bash
cd /d "E:\NK Labs\Voicenk"
npm install web-push
npm install -D @types/web-push
```

## 4. Generate VAPID keys once

Run:

```bash
npx web-push generate-vapid-keys --json
```

It returns:

```json
{
  "publicKey": "...",
  "privateKey": "..."
}
```

Store them permanently. Do not generate new keys after users subscribe, or existing subscriptions may stop working.

## 5. Add local environment variables

Add to `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
VAPID_SUBJECT=mailto:YOUR_EMAIL
PUSH_WEBHOOK_SECRET=CREATE_A_LONG_RANDOM_SECRET
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
```

Example PowerShell command to create a webhook secret:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

## 6. Add Vercel environment variables

In Vercel → VoiceNK → Settings → Environment Variables, add the same five variables:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
PUSH_WEBHOOK_SECRET
SUPABASE_SECRET_KEY
```

Apply them to Production and Preview as needed.

Redeploy after saving.

## 7. Copy package files

Copy only the files included in this ZIP into matching paths in VoiceNK.

Replace:

```text
components/layout/AppShell.tsx
```

Add:

```text
public/push-sw.js
lib/notifications/push.ts
features/notifications/components/NotificationManager.tsx
app/api/notifications/send/route.ts
```

Do not delete `.git`, `.env.local`, `node_modules`, or existing source files not present in this package.

## 8. Create the Supabase Database Webhook

Open:

Supabase → Database → Webhooks → Create a new webhook

Use:

```text
Name: voicenk-new-message-push
Table: public.messages
Events: INSERT
Type: HTTP Request
Method: POST
URL: https://YOUR-VOICENK-DOMAIN/api/notifications/send
```

Add this request header:

```text
x-voicenk-webhook-secret: YOUR_PUSH_WEBHOOK_SECRET
```

The header value must exactly match the Vercel `PUSH_WEBHOOK_SECRET`.

Do not point the webhook to localhost. Use the deployed HTTPS VoiceNK URL.

## 9. Local checks

Run:

```bash
npm run lint
npm run build
npm run dev
```

The notification send webhook cannot be fully tested from Supabase against localhost. Subscription UI can be tested locally in Chrome, but end-to-end delivery should be tested after deployment.

## 10. Test after deployment

Use two accounts and preferably two devices.

1. Sign in on the receiving phone.
2. Tap Enable notifications.
3. Confirm a row appears in `push_subscriptions`.
4. Close or background VoiceNK.
5. Send a voice message from the other account.
6. Confirm the receiving phone shows:
   `VoiceNK — New voice message from <sender>`.
7. Tap the notification and confirm VoiceNK opens.

## Platform notes

- Android Chrome and installed Android PWAs support Web Push well.
- Desktop Chrome, Edge and Firefox support it.
- iPhone/iPad push notifications require VoiceNK to be installed to the Home Screen and opened as an installed PWA.
- HTTPS is required in production.
- If the user blocks notifications, the browser settings must be changed manually.

## Privacy

Do not send transcripts, translations, booking details, or voice content through push notification payloads. This package intentionally sends only the sender display name and conversation identifier.
