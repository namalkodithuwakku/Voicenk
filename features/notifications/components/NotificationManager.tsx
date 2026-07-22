"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import {
  isIosDevice,
  isStandalonePwa,
  urlBase64ToUint8Array,
} from "@/lib/notifications/push";

const DISMISS_KEY = "voicenk-notifications-dismissed";
const DISMISS_DAYS = 7;

type NotificationState =
  | "hidden"
  | "unsupported"
  | "ios_install_required"
  | "ready"
  | "enabling"
  | "enabled"
  | "denied"
  | "error";

export function NotificationManager() {
  const { user } = useAuth();
  const [state, setState] =
    useState<NotificationState>("hidden");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      setState("hidden");
      return;
    }

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }

    if (
      isIosDevice() &&
      !isStandalonePwa()
    ) {
      setState("ios_install_required");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    if (Notification.permission === "granted") {
      void ensureSubscription();
      return;
    }

    const dismissedAt = Number(
      window.localStorage.getItem(DISMISS_KEY) ?? "0",
    );

    const dismissalMs =
      DISMISS_DAYS * 24 * 60 * 60 * 1000;

    if (
      dismissedAt > 0 &&
      Date.now() - dismissedAt < dismissalMs
    ) {
      setState("hidden");
      return;
    }

    setState("ready");
  }, [user]);

  async function ensureSubscription() {
    if (!user) return;

    try {
      setState("enabling");
      setError("");

      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

      if (!publicKey) {
        throw new Error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.",
        );
      }

      const registration =
        await navigator.serviceWorker.register(
          "/push-sw.js",
          {
            scope: "/",
          },
        );

      await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(publicKey),
          });
      }

      const serialized = subscription.toJSON();
      const p256dh = serialized.keys?.p256dh;
      const auth = serialized.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error(
          "The browser did not return valid push keys.",
        );
      }

      const { error: saveError } = await createClient()
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            enabled: true,
          },
          {
            onConflict: "endpoint",
          },
        );

      if (saveError) {
        throw saveError;
      }

      window.localStorage.removeItem(DISMISS_KEY);
      setState("enabled");
    } catch (subscriptionError) {
      setError(
        subscriptionError instanceof Error
          ? subscriptionError.message
          : "Notifications could not be enabled.",
      );
      setState("error");
    }
  }

  async function enableNotifications() {
    if (!user) return;

    const permission =
      await Notification.requestPermission();

    if (permission === "denied") {
      setState("denied");
      return;
    }

    if (permission !== "granted") {
      setState("ready");
      return;
    }

    await ensureSubscription();
  }

  function dismiss() {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now()),
    );
    setState("hidden");
  }

  if (
    state === "hidden" ||
    state === "unsupported" ||
    state === "enabled"
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-[80] mx-auto max-w-sm">
      <div className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-accent-strong">
              VoiceNK notifications
            </p>
            <h2 className="mt-1 text-lg font-black">
              Never miss a voice message
            </h2>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Close notification setup"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-soft font-black"
          >
            ×
          </button>
        </div>

        {state === "ios_install_required" && (
          <p className="mt-3 rounded-xl bg-accent-soft p-3 text-xs font-bold leading-5">
            On iPhone, install VoiceNK using Safari →
            Share → Add to Home Screen. Open the installed
            app and enable notifications there.
          </p>
        )}

        {state === "denied" && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">
            Notifications are blocked in your browser settings.
            Allow notifications for VoiceNK, then reopen the app.
          </p>
        )}

        {state === "error" && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">
            {error}
          </p>
        )}

        {(state === "ready" ||
          state === "error") && (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="mt-4 min-h-12 w-full rounded-xl bg-accent text-sm font-black text-foreground"
          >
            Enable notifications
          </button>
        )}

        {state === "enabling" && (
          <div className="mt-4 rounded-xl bg-accent-soft p-3 text-center text-xs font-black text-accent-strong">
            Enabling notifications…
          </div>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 min-h-10 w-full text-xs font-black text-muted"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
