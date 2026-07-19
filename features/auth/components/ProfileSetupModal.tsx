"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { languages } from "@/lib/languages";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function ProfileSetupModal() {
  const { user, profile, profileLoading, refreshProfile } = useAuth();

  if (!user || profile || profileLoading) return null;

  return (
    <ProfileSetupForm
      key={user.id}
      user={user}
      refreshProfile={refreshProfile}
    />
  );
}

type ProfileSetupFormProps = {
  user: User;
  refreshProfile: () => Promise<void>;
};

function ProfileSetupForm({
  user,
  refreshProfile,
}: ProfileSetupFormProps) {
  const suggestedName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "";

  const [displayName, setDisplayName] = useState(suggestedName);
  const [voicenkId, setVoicenkId] = useState(() =>
    makeSuggestedId(suggestedName),
  );
  const [language, setLanguage] = useState("en");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredLanguages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return languages;

    return languages.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.nativeName.toLowerCase().includes(normalized),
    );
  }, [query]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();

    const cleanName = displayName.trim();
    const cleanId = normalizeVoicenkId(voicenkId);

    if (cleanName.length < 2) {
      setError("Enter a display name with at least two characters.");
      return;
    }

    if (!/^[a-z0-9_-]{3,24}$/.test(cleanId)) {
      setError(
        "Voicenk ID must be 3–24 characters using lowercase letters, numbers, _ or -.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: saveError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: cleanName,
      voicenk_id: cleanId,
      preferred_language: language,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    });

    if (saveError) {
      setError(
        saveError.code === "23505"
          ? "That Voicenk ID is already taken. Try another."
          : saveError.message,
      );
    } else {
      await refreshProfile();
    }

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto min-h-dvh w-full max-w-md bg-surface px-5 py-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
          Welcome to Voicenk
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight tracking-[-0.05em]">
          Create your voice identity.
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-muted">
          This is how people will recognise you and which language you prefer
          to hear.
        </p>

        <form onSubmit={saveProfile} className="mt-8 space-y-5">
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              className="min-h-14 w-full rounded-2xl border border-border px-4 font-bold outline-none focus:border-accent"
              placeholder="Your name"
            />
          </Field>

          <Field label="Voicenk ID">
            <div className="flex min-h-14 items-center rounded-2xl border border-border px-4 focus-within:border-accent">
              <span className="font-black text-muted">@</span>
              <input
                value={voicenkId}
                onChange={(event) =>
                  setVoicenkId(normalizeVoicenkId(event.target.value))
                }
                className="min-w-0 flex-1 bg-transparent px-1 font-bold outline-none"
                placeholder="your-id"
              />
            </div>
          </Field>

          <Field label="Preferred language">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search languages"
              className="mb-3 min-h-12 w-full rounded-2xl bg-surface-soft px-4 text-sm font-bold outline-none"
            />
            <div className="max-h-52 overflow-y-auto rounded-2xl border border-border">
              {filteredLanguages.map((item) => (
                <label
                  key={item.code}
                  className="flex cursor-pointer items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span>
                    <span className="block text-sm font-black">{item.name}</span>
                    <span className="block text-xs font-semibold text-muted">
                      {item.nativeName}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="language"
                    value={item.code}
                    checked={language === item.code}
                    onChange={() => setLanguage(item.code)}
                    className="h-5 w-5 accent-amber-500"
                  />
                </label>
              ))}
            </div>
          </Field>

          {error && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="min-h-14 w-full rounded-2xl bg-accent px-5 font-black text-foreground disabled:opacity-60"
          >
            {saving ? "Creating profile…" : "Enter Voicenk"}
          </button>
        </form>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function normalizeVoicenkId(value: string) {
  return value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
}

function makeSuggestedId(name: string) {
  const base =
    normalizeVoicenkId(name) ||
    `voice-${Math.random().toString(36).slice(2, 6)}`;

  return base.slice(0, 18);
}
