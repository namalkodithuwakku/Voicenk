"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/hooks/useAuth";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  async function continueWithGoogle() {
    if (!configured) return;
    setError("");

    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) setError(authError.message);
  }

  async function continueWithEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!configured || !email.trim()) return;

    setSending(true);
    setError("");
    setMessage("");

    const { error: authError } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setMessage("Check your email for the secure Voicenk sign-in link.");
    }

    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="safe-bottom w-full max-w-md rounded-t-[2rem] bg-surface p-6 shadow-2xl sm:rounded-[2rem]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
              Voicenk account
            </p>
            <h2
              id="auth-title"
              className="mt-2 text-3xl font-black tracking-[-0.04em]"
            >
              Sign in to send voice messages.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-soft text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!configured ? (
          <div className="mt-6 rounded-2xl bg-accent-soft p-4 text-sm font-bold leading-6 text-accent-strong">
            Supabase is not configured yet. Complete the setup guide and add
            the environment variables. Guest Interpreter mode remains
            available.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={continueWithGoogle}
              className="mt-7 min-h-14 w-full rounded-2xl bg-foreground px-5 font-black text-white"
            >
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-black uppercase tracking-widest text-muted">
                or email
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={continueWithEmail}>
              <label className="text-xs font-black uppercase tracking-widest text-muted">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="mt-2 min-h-14 w-full rounded-2xl border border-border bg-surface px-4 font-bold outline-none transition focus:border-accent"
              />
              <button
                type="submit"
                disabled={sending}
                className="mt-3 min-h-14 w-full rounded-2xl bg-accent px-5 font-black text-foreground disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send secure sign-in link"}
              </button>
            </form>
          </>
        )}

        {message && (
          <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-muted">
          Interpreter mode does not require an account.
        </p>
      </div>
    </div>
  );
}
