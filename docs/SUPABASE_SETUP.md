# Supabase Setup — Package 02

## 1. Create a Supabase project

Create the project, then open its dashboard.

## 2. Add environment variables

Copy `.env.example` to `.env.local` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use the values from the Supabase **Connect** dialog.

## 3. Create the profile table

Open **SQL Editor** and run:

`supabase/migrations/001_profiles.sql`

## 4. Configure redirect URLs

In **Authentication → URL Configuration** add:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

For Vercel, also add:

`https://YOUR-DOMAIN/auth/callback`

## 5. Email login

Keep the Email provider enabled. Voicenk uses a passwordless magic-link flow.

## 6. Google login

In **Authentication → Providers → Google**:

1. Enable Google.
2. Create OAuth credentials in Google Cloud.
3. Copy the Supabase callback URL shown in the provider screen into Google Cloud.
4. Add the Google Client ID and Client Secret to Supabase.
5. Save.

## 7. Restart the app

```bash
npm run dev
```

Guest Interpreter mode works before Supabase is configured.
