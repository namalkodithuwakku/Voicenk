# VoiceNK Final V1 Safe Package

This package was rebuilt from the uploaded project's exact Git HEAD.

## Preserved unchanged

- Authentication
- Supabase client/server/session code
- Google and email login callback handling
- Existing OpenAI server integration
- Existing mobile shell, header, navigation, theme and branding
- Existing profile setup
- Existing package.json and package-lock.json
- Existing TypeScript, ESLint, Next.js and PostCSS configuration
- Existing interpreter result and language-picker components
- Existing environment variable names

## Intentionally added or replaced

- Tap-to-record / tap-to-stop editable Interpreter workflow
- User search and contact requests
- One-to-one conversation UI
- Editable transcript before sending
- Message transcription and translated speech routes
- Messaging database and storage migration
- Messaging types and setup guide

## Safe installation

Do not delete your current project.

1. Create a backup or Git commit.
2. Copy this package over the project, replacing matching files.
3. Preserve `.git` and `.env.local`.
4. Run the new SQL migration only after reviewing it.
5. Run `npm install`, `npm run lint`, and `npm run build`.
6. Test login and Interpreter before pushing.
