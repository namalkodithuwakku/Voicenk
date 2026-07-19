"use client";

import { UserIcon } from "@/components/ui/Icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getLanguageName } from "@/lib/languages";

export function ProfileScreen({ onSignIn }: { onSignIn: () => void }) {
  const { configured, user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[68vh] items-center justify-center text-sm font-bold text-muted">
        Loading profile…
      </div>
    );
  }

  if (!user) {
    return (
      <section className="py-6">
        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-soft text-muted">
            <UserIcon className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
            Guest mode
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
            Use Interpreter without an account.
          </h1>
          <p className="mt-4 text-sm font-medium leading-6 text-muted">
            Sign in only when you want messages, cloud identity and future
            multi-device access.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 min-h-14 w-full rounded-2xl bg-accent px-5 font-black text-foreground"
          >
            {configured ? "Sign in or create account" : "View setup status"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6">
      <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-foreground text-xl font-black text-accent">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            (profile?.display_name ?? user.email ?? "V").slice(0, 1).toUpperCase()
          )}
        </div>

        <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">
          {profile?.display_name ?? "Voicenk user"}
        </h1>
        <p className="mt-1 font-bold text-accent-strong">
          @{profile?.voicenk_id ?? "setting-up"}
        </p>

        <div className="mt-6 grid gap-3">
          <InfoRow label="Email" value={user.email ?? "Not available"} />
          <InfoRow
            label="Preferred language"
            value={
              profile
                ? getLanguageName(profile.preferred_language)
                : "Complete profile setup"
            }
          />
          <InfoRow label="Account" value="Voicenk member" />
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 min-h-12 w-full rounded-2xl bg-surface-soft px-5 font-black text-foreground"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-soft p-4">
      <span className="block text-[10px] font-black uppercase tracking-widest text-muted">
        {label}
      </span>
      <span className="mt-1 block break-words text-sm font-black">{value}</span>
    </div>
  );
}
