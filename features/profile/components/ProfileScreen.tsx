"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { UserIcon } from "@/components/ui/Icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { getLanguageName, languages } from "@/lib/languages";
import type {
  ProfileVisibility,
  VoiceCategory,
} from "@/types/profile";

const voiceOptions = [
  { value: "cedar", label: "Male voice", category: "male" as const },
  { value: "marin", label: "Female voice", category: "female" as const },
  { value: "sage", label: "Neutral voice", category: "neutral" as const },
];

export function ProfileScreen({ onSignIn }: { onSignIn: () => void }) {
  const {
    configured,
    user,
    profile,
    loading,
    refreshProfile,
    signOut,
  } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [voicenkId, setVoicenkId] = useState("");
  const [language, setLanguage] = useState("en");
  const [voice, setVoice] = useState("marin");
  const [voiceCategory, setVoiceCategory] =
    useState<VoiceCategory>("neutral");
  const [visibility, setVisibility] =
    useState<ProfileVisibility>("visible");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const selectedVoice = useMemo(
    () => voiceOptions.find((item) => item.value === voice) ?? voiceOptions[1],
    [voice],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-bold text-muted">
        Loading profile…
      </div>
    );
  }

  if (!user) {
    return (
      <section className="py-4">
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
            Sign in when you want contacts, voice messages and a global
            VoiceNK identity.
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

  function beginEdit() {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setVoicenkId(profile.voicenk_id);
    setLanguage(profile.preferred_language);
    setVoice(profile.preferred_voice ?? "marin");
    setVoiceCategory(profile.voice_category ?? "neutral");
    setVisibility(profile.profile_visibility ?? "visible");
    setError("");
    setMessage("");
    setEditing(true);
  }

  function normalizeId(value: string) {
    return value
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    if (!user) {
      setError("You must be signed in to update your profile.");
      return;
    }

    const userId = user.id;

    const cleanName = displayName.trim();
    const cleanId = normalizeId(voicenkId);

    if (cleanName.length < 2 || cleanName.length > 40) {
      setError("Display name must be 2–40 characters.");
      return;
    }

    if (!/^[a-z0-9_-]{3,24}$/.test(cleanId)) {
      setError("VoiceNK ID must be 3–24 lowercase letters, numbers, _ or -.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: updateError } = await createClient()
      .from("profiles")
      .update({
        display_name: cleanName,
        voicenk_id: cleanId,
        preferred_language: language,
        preferred_voice: voice,
        voice_category: voiceCategory,
        profile_visibility: visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "That VoiceNK ID is already taken."
          : updateError.message,
      );
    } else {
      await refreshProfile();
      setMessage("Profile updated.");
      setEditing(false);
    }

    setSaving(false);
  }

  async function previewVoice(value: string) {
    setPreviewing(value);
    setError("");

    try {
      const response = await fetch("/api/profile/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice: value,
          language,
        }),
      });
      const data = (await response.json()) as {
        audioBase64?: string;
        audioMimeType?: string;
        error?: string;
      };

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error ?? "Voice preview failed.");
      }

      const bytes = Uint8Array.from(
        atob(data.audioBase64),
        (character) => character.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: data.audioMimeType ?? "audio/mpeg" }),
      );
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Voice preview failed.",
      );
    } finally {
      setPreviewing("");
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") {
      setError('Type DELETE exactly to confirm account deletion.');
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile/delete-account", {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Account deletion failed.");
      }

      await signOut();
      window.location.assign("/");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Account deletion failed.",
      );
      setDeleting(false);
    }
  }

  if (editing && profile) {
    return (
      <section className="h-full overflow-y-auto py-3">
        <form
          onSubmit={saveProfile}
          className="rounded-[1.7rem] border border-border bg-surface p-4 shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-accent-strong">
                Edit profile
              </p>
              <h1 className="mt-1 text-2xl font-black">Your VoiceNK identity</h1>
            </div>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="grid h-10 w-10 place-items-center rounded-full bg-surface-soft font-black"
            >
              ×
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Display name" hint="2–40 characters">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
                className="min-h-12 w-full rounded-xl border border-border px-3 font-bold outline-none focus:border-accent"
              />
            </Field>

            <Field label="VoiceNK ID" hint="3–24: a–z, 0–9, _ and -">
              <div className="flex min-h-12 items-center rounded-xl border border-border px-3 focus-within:border-accent">
                <span className="font-black text-muted">@</span>
                <input
                  value={voicenkId}
                  onChange={(event) => setVoicenkId(normalizeId(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent px-1 font-bold outline-none"
                />
              </div>
            </Field>

            <Field label="Preferred language">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-border bg-surface px-3 font-bold outline-none focus:border-accent"
              >
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} — {item.nativeName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Translated voice" hint="Listen and choose the voice that represents you.">
              <div className="space-y-2">
                {voiceOptions.map((option) => {
                  const active = voice === option.value;
                  return (
                    <div
                      key={option.value}
                      className={`flex items-center gap-2 rounded-xl border p-2 ${
                        active ? "border-accent bg-accent-soft" : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setVoice(option.value);
                          setVoiceCategory(option.category);
                        }}
                        className="min-h-10 flex-1 text-left text-sm font-black"
                      >
                        {option.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => void previewVoice(option.value)}
                        disabled={Boolean(previewing)}
                        className="rounded-lg bg-foreground px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        {previewing === option.value ? "Playing…" : "▶ Preview"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Field>

            <Field label="Privacy">
              <div className="grid grid-cols-2 gap-2">
                {(["visible", "invisible"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVisibility(value)}
                    className={`min-h-12 rounded-xl text-sm font-black capitalize ${
                      visibility === value
                        ? "bg-accent text-foreground"
                        : "bg-surface-soft text-muted"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                {visibility === "visible"
                  ? "People can find you and send contact requests."
                  : "Hidden from new searches. Existing contacts and chats still work."}
              </p>
            </Field>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 min-h-13 w-full rounded-xl bg-accent font-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="h-full overflow-y-auto py-3">
      <div className="rounded-[1.7rem] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-foreground text-xl font-black text-accent">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            (profile?.display_name ?? user.email ?? "V").slice(0, 1).toUpperCase()
          )}
        </div>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">
          {profile?.display_name ?? "VoiceNK user"}
        </h1>
        <p className="mt-1 font-bold text-accent-strong">
          @{profile?.voicenk_id ?? "setting-up"}
        </p>

        <div className="mt-5 grid gap-2">
          <InfoRow label="Email" value={user.email ?? "Not available"} />
          <InfoRow
            label="Preferred language"
            value={profile ? getLanguageName(profile.preferred_language) : "Complete setup"}
          />
          <InfoRow label="Translated voice" value={
              voiceOptions.find((item) => item.value === profile?.preferred_voice)?.label ??
              selectedVoice.label
            } />
          <InfoRow
            label="Privacy"
            value={profile?.profile_visibility === "invisible" ? "Invisible" : "Visible"}
          />
        </div>

        {message && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-xs font-bold text-green-700">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={beginEdit}
          disabled={!profile}
          className="mt-5 min-h-12 w-full rounded-xl bg-accent px-5 font-black disabled:opacity-50"
        >
          Edit profile
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 min-h-12 w-full rounded-xl bg-surface-soft px-5 font-black text-foreground"
        >
          Sign out
        </button>

        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirmation("");
              setError("");
            }}
            className="mt-5 min-h-12 w-full rounded-xl border border-red-200 bg-red-50 px-5 font-black text-red-700"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-black text-red-800">
              Permanently delete this VoiceNK account?
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-red-700">
              This removes your profile, contacts, memberships and owned voice
              recordings. This action cannot be undone. Type DELETE to continue.
            </p>
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="mt-3 min-h-12 w-full rounded-xl border border-red-200 bg-white px-3 font-black outline-none focus:border-red-500"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                }}
                className="min-h-12 rounded-xl bg-white text-xs font-black text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || deleteConfirmation !== "DELETE"}
                onClick={() => void deleteAccount()}
                className="min-h-12 rounded-xl bg-red-600 text-xs font-black text-white disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-widest text-muted">
        {label}
      </span>
      {hint && <span className="mb-2 mt-1 block text-[10px] font-semibold text-muted">{hint}</span>}
      {!hint && <span className="mb-2 block" />}
      {children}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-soft p-3">
      <span className="block text-[9px] font-black uppercase tracking-widest text-muted">
        {label}
      </span>
      <span className="mt-1 block break-words text-sm font-black">{value}</span>
    </div>
  );
}
