"use client";

import { MessagesIcon } from "@/components/ui/Icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getLanguageName } from "@/lib/languages";

export function MessagesScreen({ onSignIn }: { onSignIn: () => void }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[68vh] items-center justify-center text-sm font-bold text-muted">
        Checking your session…
      </div>
    );
  }

  if (!user) {
    return (
      <section className="flex min-h-[68vh] flex-col justify-center py-8">
        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
            <MessagesIcon className="h-7 w-7" />
          </div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
            Send mode
          </p>
          <h1 className="text-3xl font-black leading-tight tracking-[-0.04em]">
            Sign in when you’re ready to send.
          </h1>
          <p className="mt-4 text-sm font-medium leading-6 text-muted">
            Interpreter mode remains available without an account. Sign in to
            save your identity and use multilingual voice messaging.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 min-h-14 w-full rounded-2xl bg-foreground px-5 font-black text-white"
          >
            Continue to sign in
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6">
      <div className="rounded-[2rem] bg-foreground p-6 text-white shadow-[var(--shadow-soft)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
          Welcome, {profile?.display_name ?? "Voicenk user"}
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.04em]">
          Your voice conversations will live here.
        </h1>
        <p className="mt-4 text-sm font-medium leading-6 text-white/65">
          Preferred language:{" "}
          {profile ? getLanguageName(profile.preferred_language) : "Not set"}
        </p>
      </div>

      <div className="mt-5 rounded-[2rem] border border-dashed border-border p-8 text-center">
        <MessagesIcon className="mx-auto h-8 w-8 text-muted" />
        <p className="mt-4 font-black">No conversations yet</p>
        <p className="mt-2 text-sm font-medium leading-6 text-muted">
          Contacts and voice messaging arrive in the Messaging package.
        </p>
      </div>
    </section>
  );
}
