# Package 03.1 — Stability Update

This patch changes only four files:

- `eslint.config.mjs`
- `features/auth/components/AuthProvider.tsx`
- `features/auth/components/ProfileSetupModal.tsx`
- `features/interpreter/components/InterpreterScreen.tsx`

## Fixes

- Excludes generated `.next` files at any folder depth.
- Removes React 19 lint violations caused by synchronous state updates in effects.
- Loads profile data from authentication callbacks instead of a second effect.
- Initializes profile setup fields through a keyed child component.
- Displays microphone permission errors as derived UI state.

## Important folder check

The lint log showed a nested path:

`E:\NK Labs\Voicenk\voicenk\.next`

Check whether an old nested `voicenk` project folder exists inside your current
project. If it is an accidental duplicate and not your active app, remove it
after taking a backup. The new ESLint config ignores nested generated folders,
but duplicate source projects should not remain long-term.
