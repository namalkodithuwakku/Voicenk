"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MicrophoneIcon } from "@/components/ui/Icons";
import { createClient } from "@/lib/supabase/client";
import { formatRecordingTime } from "@/lib/audio";
import { useVoiceRecorder } from "@/features/interpreter/hooks/useVoiceRecorder";
import type { ConversationSummary, VoiceMessage } from "@/types/messaging";

type DeletableVoiceMessage = VoiceMessage & {
  deleted_for_everyone?: boolean | null;
  deleted_by_sender?: boolean | null;
  deleted_by_receiver?: boolean | null;
  deleted_at?: string | null;
};

type ComposerStage =
  | "idle"
  | "recording"
  | "transcribing"
  | "review"
  | "review_voice"
  | "sending";

type ConversationViewProps = {
  conversation: ConversationSummary;
  currentUserId: string;
  sourceLanguage: string;
  senderVoice: string;
  onBack: () => void;
};

export function ConversationView({
  conversation,
  currentUserId,
  sourceLanguage,
  senderVoice,
  onBack,
}: ConversationViewProps) {
  const [messages, setMessages] = useState<DeletableVoiceMessage[]>([]);
  const [stage, setStage] = useState<ComposerStage>("idle");
  const [transcript, setTranscript] = useState("");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const recorder = useVoiceRecorder();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    const { data, error: loadError } = await createClient()
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const visibleMessages = ((data ?? []) as DeletableVoiceMessage[]).filter(
      (message) => {
        if (message.deleted_for_everyone) return true;

        if (
          message.sender_id === currentUserId &&
          message.deleted_by_sender
        ) {
          return false;
        }

        if (
          message.sender_id !== currentUserId &&
          message.deleted_by_receiver
        ) {
          return false;
        }

        return true;
      },
    );

    setMessages(visibleMessages);
  }, [conversation.id, currentUserId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMessages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, stage]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => void loadMessages(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, loadMessages]);

  async function start() {
    setError("");
    setTranscript("");
    setRecordingBlob(null);

    if (await recorder.start()) setStage("recording");
  }

  async function stop() {
    const recording = await recorder.stop();

    if (!recording) {
      setStage("idle");
      return;
    }

    setRecordingBlob(recording.blob);

    const targetLanguage = conversation.contact.preferred_language;
    const needsTranslation =
      sourceLanguage.trim().toLowerCase() !==
      targetLanguage.trim().toLowerCase();

    if (!needsTranslation) {
      setTranscript("");
      setStage("review_voice");
      return;
    }

    setStage("transcribing");

    const form = new FormData();
    const extension = recording.blob.type.includes("mp4")
      ? "m4a"
      : recording.blob.type.includes("ogg")
        ? "ogg"
        : "webm";

    form.set("audio", recording.blob, `message.${extension}`);
    form.set("sourceLanguage", sourceLanguage);

    try {
      const response = await fetch("/api/interpreter/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        transcript?: string;
        error?: string;
      };

      if (!response.ok || !data.transcript) {
        throw new Error(data.error ?? "Transcription failed.");
      }

      setTranscript(data.transcript);
      setStage("review");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Transcription failed.",
      );
      setStage("idle");
    }
  }

  function reset() {
    recorder.cancel();
    setRecordingBlob(null);
    setTranscript("");
    setStage("idle");
    setError("");
  }

  async function send() {
    if (!recordingBlob) return;

    setStage("sending");
    setError("");

    const targetLanguage = conversation.contact.preferred_language;
    const needsTranslation =
      sourceLanguage.trim().toLowerCase() !==
      targetLanguage.trim().toLowerCase();

    try {
      const confirmedTranscript = transcript.trim();
      let translatedText: string | null = null;
      let originalTranscript: string | null = null;
      let translationStatus: VoiceMessage["translation_status"] =
        "not_required";

      if (needsTranslation) {
        if (!confirmedTranscript) {
          throw new Error("Transcript is required before translation.");
        }

        originalTranscript = confirmedTranscript;
        const response = await fetch("/api/interpreter/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: confirmedTranscript,
            sourceLanguage,
            targetLanguage,
            includeVoice: false,
          }),
        });
        const data = (await response.json()) as {
          translation?: string;
          error?: string;
        };

        if (!response.ok || !data.translation) {
          throw new Error(data.error ?? "Translation failed.");
        }

        translatedText = data.translation;
        translationStatus = "completed";
      }

      const extension = recordingBlob.type.includes("mp4")
        ? "m4a"
        : recordingBlob.type.includes("ogg")
          ? "ogg"
          : "webm";
      const path =
        `${currentUserId}/${conversation.id}/` +
        `${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from("voice-messages")
        .upload(path, recordingBlob, {
          contentType: recordingBlob.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: currentUserId,
        audio_path: path,
        original_transcript: originalTranscript,
        translated_text: translatedText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        translation_status: translationStatus,
        sender_voice: senderVoice,
      });

      if (insertError) throw insertError;

      reset();
      await loadMessages();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Message could not be sent.",
      );
      setStage("review");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col py-2">
      <div className="flex shrink-0 items-center gap-3 border-b border-border pb-2">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full bg-surface-soft text-lg"
          aria-label="Back"
        >
          ‹
        </button>

        <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-foreground font-black text-accent">
          {conversation.contact.avatar_url ? (
            <Image
              src={conversation.contact.avatar_url}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          ) : (
            conversation.contact.display_name.slice(0, 1).toUpperCase()
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-black">
            {conversation.contact.display_name}
          </p>
          <p className="truncate text-[10px] font-bold text-accent-strong">
            @{conversation.contact.voicenk_id}
          </p>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 overflow-y-auto py-3"
      >
        <div className="space-y-2">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.sender_id === currentUserId}
              currentUserId={currentUserId}
              onRefresh={loadMessages}
            />
          ))}
          {messages.length === 0 && (
            <p className="py-12 text-center text-xs font-bold text-muted">
              Record the first voice message.
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border pt-2">
        {stage === "idle" && (
          <button
            type="button"
            onClick={start}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-black"
          >
            <MicrophoneIcon className="h-5 w-5" />
            Tap to record
          </button>
        )}

        {stage === "recording" && (
          <button
            type="button"
            onClick={stop}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-black text-white"
          >
            <MicrophoneIcon className="h-5 w-5" />
            Tap to stop · {formatRecordingTime(recorder.durationMs)}
          </button>
        )}

        {(stage === "transcribing" || stage === "sending") && (
          <div className="rounded-2xl bg-accent-soft p-4 text-center text-xs font-black text-accent-strong">
            {stage === "transcribing"
              ? "Understanding your voice…"
              : sourceLanguage === conversation.contact.preferred_language
                ? "Sending original voice…"
                : "Translating and sending…"}
          </div>
        )}

        {stage === "review" && (
          <div>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              className="min-h-20 w-full resize-none rounded-2xl border border-border bg-surface-soft p-3 text-sm font-bold outline-none focus:border-accent"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={reset}
                className="min-h-12 rounded-xl bg-surface-soft text-xs font-black"
              >
                Record again
              </button>
              <button
                type="button"
                disabled={!transcript.trim()}
                onClick={send}
                className="min-h-12 rounded-xl bg-accent text-xs font-black disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {stage === "review_voice" && (
          <div className="rounded-2xl bg-surface-soft p-3">
            <p className="text-sm font-black">Voice message ready</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              Both users use the same language, so VoiceNK will send the
              original recording without transcription, translation or AI voice.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={reset}
                className="min-h-12 rounded-xl bg-surface text-xs font-black"
              >
                Record again
              </button>
              <button
                type="button"
                onClick={send}
                className="min-h-12 rounded-xl bg-accent text-xs font-black"
              >
                Send voice
              </button>
            </div>
          </div>
        )}

        {(error || recorder.permissionError) && (
          <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-bold text-red-700">
            {error || recorder.permissionError}
          </p>
        )}
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  mine,
  currentUserId,
  onRefresh,
}: {
  message: DeletableVoiceMessage;
  mine: boolean;
  currentUserId: string;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function beginLongPress() {
    clearLongPress();

    longPressTimerRef.current = setTimeout(() => {
      setMenuOpen(true);
    }, 600);
  }

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function playOriginal() {
    if (!message.audio_path || message.deleted_for_everyone) return;

    const { data, error } = await createClient().storage
      .from("voice-messages")
      .createSignedUrl(message.audio_path, 120);

    if (error || !data?.signedUrl) return;

    const audio = new Audio(data.signedUrl);

    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);

    await audio.play();
  }

  async function playTranslated() {
    if (message.deleted_for_everyone) return;

    if (message.translation_status === "not_required") {
      await playOriginal();
      return;
    }

    setPlaying(true);

    try {
      const response = await fetch("/api/messages/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message.translated_text,
          language: message.target_language,
          voice: message.sender_voice,
        }),
      });

      const data = (await response.json()) as {
        audioBase64?: string;
        audioMimeType?: string;
        error?: string;
      };

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error ?? "Voice playback failed.");
      }

      const bytes = Uint8Array.from(
        atob(data.audioBase64),
        (character) => character.charCodeAt(0),
      );

      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: data.audioMimeType ?? "audio/mpeg",
        }),
      );

      const audio = new Audio(url);

      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  async function copyTranscript() {
    const textToCopy =
      (mine ? message.original_transcript : message.translated_text) ??
      message.original_transcript ??
      message.translated_text ??
      "";

    if (!textToCopy) return;

    await navigator.clipboard.writeText(textToCopy);
    setMenuOpen(false);
  }

  async function deleteForMe() {
    setDeleting(true);

    try {
      const field =
        message.sender_id === currentUserId
          ? "deleted_by_sender"
          : "deleted_by_receiver";

      const { error } = await createClient()
        .from("messages")
        .update({ [field]: true })
        .eq("id", message.id);

      if (error) {
        throw error;
      }

      setMenuOpen(false);
      await onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  async function deleteForEveryone() {
    if (!mine) return;

    const confirmed = window.confirm(
      "Delete this voice message for everyone?",
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const supabase = createClient();

      if (message.audio_path) {
        const { error: storageError } = await supabase.storage
          .from("voice-messages")
          .remove([message.audio_path]);

        if (storageError) {
          throw storageError;
        }
      }

      const { error: updateError } = await supabase
        .from("messages")
        .update({
          deleted_for_everyone: true,
          deleted_at: new Date().toISOString(),
          audio_path: null,
          original_transcript: null,
          translated_text: null,
        })
        .eq("id", message.id)
        .eq("sender_id", currentUserId);

      if (updateError) {
        throw updateError;
      }

      setMenuOpen(false);
      await onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  if (message.deleted_for_everyone) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <article
          className={`max-w-[84%] rounded-2xl px-4 py-3 text-xs font-bold italic ${
            mine
              ? "bg-accent-soft text-muted"
              : "bg-foreground text-white/65"
          }`}
        >
          🗑 This voice message was deleted.
          <div className="mt-1 text-right text-[9px] not-italic opacity-55">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </article>
      </div>
    );
  }

  const displayed =
    (mine ? message.original_transcript : message.translated_text) ??
    "Voice message";

  const hasOriginalTranscript = Boolean(
    message.original_transcript?.trim(),
  );

  return (
    <>
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <article
          onPointerDown={beginLongPress}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuOpen(true);
          }}
          className={`max-w-[84%] select-none rounded-2xl p-3 ${
            mine ? "bg-accent-soft" : "bg-foreground text-white"
          }`}
        >
          <button
            type="button"
            disabled={playing}
            onClick={mine ? playOriginal : playTranslated}
            className="mb-2 rounded-full bg-accent px-3 py-1.5 text-[10px] font-black text-foreground"
          >
            {playing ? "Playing…" : "▶ Play voice"}
          </button>

          <p className="text-sm font-bold leading-6">{displayed}</p>

          <div className="mt-2 flex items-center justify-between gap-3">
            {hasOriginalTranscript ? (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="text-[10px] font-black opacity-65"
              >
                {expanded ? "Hide original" : "View original"}
              </button>
            ) : (
              <span />
            )}

            <span className="text-[9px] font-bold opacity-55">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {mine ? " ✓" : ""}
            </span>
          </div>

          {expanded && hasOriginalTranscript && (
            <div className="mt-2 border-t border-current/15 pt-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                Original
              </p>

              <p className="mt-1 text-xs font-semibold leading-5">
                {message.original_transcript ?? ""}
              </p>

              {!mine &&
                message.translation_status !== "not_required" && (
                  <button
                    type="button"
                    onClick={playOriginal}
                    className="mt-2 text-[10px] font-black text-accent"
                  >
                    Play original voice
                  </button>
                )}
            </div>
          )}
        </article>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="safe-bottom w-full max-w-sm rounded-[1.5rem] bg-surface p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-muted">
              Message options
            </p>

            {(message.original_transcript ||
              message.translated_text) && (
              <button
                type="button"
                onClick={() => void copyTranscript()}
                className="min-h-12 w-full rounded-xl px-3 text-left text-sm font-black hover:bg-surface-soft"
              >
                Copy transcript
              </button>
            )}

            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteForMe()}
              className="min-h-12 w-full rounded-xl px-3 text-left text-sm font-black hover:bg-surface-soft disabled:opacity-50"
            >
              Delete for me
            </button>

            {mine && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteForEveryone()}
                className="min-h-12 w-full rounded-xl px-3 text-left text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete for everyone
              </button>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mt-2 min-h-12 w-full rounded-xl bg-surface-soft text-sm font-black"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

