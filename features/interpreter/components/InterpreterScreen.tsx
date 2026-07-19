"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MicrophoneIcon, SwapIcon } from "@/components/ui/Icons";
import { getLanguageName } from "@/lib/languages";
import { formatRecordingTime } from "@/lib/audio";
import { LanguagePicker } from "@/features/interpreter/components/LanguagePicker";
import { InterpreterResultCard } from "@/features/interpreter/components/InterpreterResultCard";
import { useVoiceRecorder } from "@/features/interpreter/hooks/useVoiceRecorder";
import { useInterpreterAudio } from "@/features/interpreter/hooks/useInterpreterAudio";
import type {
  InterpreterResult,
  InterpreterStatus,
} from "@/types/interpreter";

type PickerSide = "source" | "target" | null;

const HOLD_DELAY_MS = 450;

export function InterpreterScreen() {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("fr");
  const [pickerSide, setPickerSide] = useState<PickerSide>(null);
  const [status, setStatus] = useState<InterpreterStatus>("idle");
  const [result, setResult] = useState<InterpreterResult | null>(null);
  const [error, setError] = useState("");
  const [isHolding, setIsHolding] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIsDownRef = useRef(false);
  const recordingStartedRef = useRef(false);

  const recorder = useVoiceRecorder();
  const player = useInterpreterAudio();

  const sourceLabel =
    sourceLanguage === "auto" ? "Auto detect" : getLanguageName(sourceLanguage);
  const targetLabel = getLanguageName(targetLanguage);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const processRecording = useCallback(
    async (blob: Blob) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      player.stop();
      setResult(null);
      setError("");
      setStatus("processing");

      const body = new FormData();
      const extension = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";

      body.set("audio", blob, `voicenk-recording.${extension}`);
      body.set("sourceLanguage", sourceLanguage);
      body.set("targetLanguage", targetLanguage);

      try {
        const response = await fetch("/api/interpreter/process", {
          method: "POST",
          body,
          signal: controller.signal,
        });

        const data = (await response.json()) as
          | InterpreterResult
          | { error?: string };

        if (!response.ok || !("translation" in data)) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "The interpreter could not process this recording.",
          );
        }

        setResult(data);
        setStatus("ready");
        await player.loadAndPlay(data.audioBase64, data.audioMimeType, true);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Interpreter processing failed.",
        );
        setStatus("error");
      }
    },
    [player, sourceLanguage, targetLanguage],
  );

  async function beginActualRecording() {
    if (!pointerIsDownRef.current || status === "processing") return;

    recorder.clearPermissionError();
    setError("");
    setResult(null);
    player.stop();
    setStatus("requesting_permission");

    const started = await recorder.start();

    if (!pointerIsDownRef.current) {
      if (started) recorder.cancel();
      setStatus("idle");
      return;
    }

    recordingStartedRef.current = started;
    setStatus(started ? "recording" : "error");
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (status === "processing" || recorder.isRecording) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    pointerIsDownRef.current = true;
    recordingStartedRef.current = false;
    setIsHolding(true);
    setError("");
    clearHoldTimer();

    holdTimerRef.current = setTimeout(() => {
      void beginActualRecording();
    }, HOLD_DELAY_MS);
  }

  async function handlePointerRelease() {
    pointerIsDownRef.current = false;
    setIsHolding(false);
    clearHoldTimer();

    if (!recordingStartedRef.current && !recorder.isRecording) {
      setStatus("idle");
      setError("Press and hold the microphone while you speak.");
      return;
    }

    if (!recorder.isRecording) return;

    const recording = await recorder.stop();
    recordingStartedRef.current = false;

    if (!recording) {
      setStatus("error");
      return;
    }

    await processRecording(recording.blob);
  }

  function swapLanguages() {
    if (status === "recording" || status === "processing") return;

    const nextSource = targetLanguage;
    const nextTarget = sourceLanguage === "auto" ? "en" : sourceLanguage;

    setSourceLanguage(nextSource);
    setTargetLanguage(nextTarget);
    setResult(null);
    player.stop();
    setStatus("idle");
  }

  function clearResult() {
    abortRef.current?.abort();
    player.stop();
    setResult(null);
    setError("");
    setStatus("idle");
  }

  const visibleError = error || recorder.permissionError;

  const micLabel =
    status === "recording"
      ? `Recording ${formatRecordingTime(recorder.durationMs)}`
      : status === "processing"
        ? "Translating…"
        : status === "requesting_permission"
          ? "Opening microphone…"
          : isHolding
            ? "Keep holding…"
            : result
              ? "Hold to speak again"
              : "Press and hold to speak";

  return (
    <section className="flex h-full min-h-0 flex-col py-3">
      <div className="shrink-0 rounded-[1.5rem] bg-foreground p-4 text-white shadow-[var(--shadow-soft)]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">
          Interpreter · No account needed
        </p>
        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-[-0.04em]">
          Speak naturally. Let Voicenk handle the language.
        </h1>
        <p className="mt-2 text-xs font-medium leading-5 text-white/65">
          Press and hold while speaking. Release when finished.
        </p>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]">
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <LanguageButton
            label="Speaker"
            language={sourceLabel}
            onClick={() => setPickerSide("source")}
          />

          <button
            type="button"
            onClick={swapLanguages}
            disabled={status === "recording" || status === "processing"}
            aria-label="Switch languages"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-strong disabled:opacity-40"
          >
            <SwapIcon className="h-4 w-4" />
          </button>

          <LanguageButton
            label="Listener"
            language={targetLabel}
            onClick={() => setPickerSide("target")}
          />
        </div>

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={() => void handlePointerRelease()}
          onPointerCancel={() => void handlePointerRelease()}
          onPointerLeave={() => {
            if (pointerIsDownRef.current) {
              void handlePointerRelease();
            }
          }}
          onContextMenu={(event) => event.preventDefault()}
          disabled={status === "processing"}
          className={`mt-4 flex min-h-16 shrink-0 touch-none select-none items-center justify-center gap-2.5 rounded-[1.35rem] px-4 text-sm font-black shadow-lg transition active:scale-[0.985] disabled:cursor-wait ${
            status === "recording"
              ? "animate-pulse bg-red-500 text-white"
              : status === "processing"
                ? "bg-surface-soft text-muted"
                : isHolding
                  ? "bg-accent-strong text-white"
                  : "bg-accent text-foreground"
          }`}
        >
          <MicrophoneIcon className="h-5 w-5" />
          {micLabel}
        </button>

        <p className="mt-2 shrink-0 text-center text-[10px] font-bold text-muted">
          Hold 0.5 sec · Maximum 30 sec
        </p>

        {visibleError && (
          <div className="mt-3 shrink-0 rounded-xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">
            {visibleError}
          </div>
        )}

        {result && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <InterpreterResultCard
              result={result}
              sourceLabel={sourceLabel}
              targetLabel={targetLabel}
              isPlaying={player.isPlaying}
              onReplay={() => void player.replay()}
              onStop={player.stop}
              onClear={clearResult}
            />
          </div>
        )}
      </div>

      <LanguagePicker
        open={pickerSide === "source"}
        title="Speaker language"
        selectedCode={sourceLanguage}
        allowAutoDetect
        onSelect={setSourceLanguage}
        onClose={() => setPickerSide(null)}
      />

      <LanguagePicker
        open={pickerSide === "target"}
        title="Listener language"
        selectedCode={targetLanguage}
        onSelect={(code) => {
          if (code !== "auto") setTargetLanguage(code);
        }}
        onClose={() => setPickerSide(null)}
      />
    </section>
  );
}

function LanguageButton({
  label,
  language,
  onClick,
}: {
  label: string;
  language: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-xl bg-surface-soft px-2.5 py-2.5 text-left transition"
    >
      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      <span className="mt-0.5 block truncate text-xs font-black text-foreground">
        {language}
      </span>
    </button>
  );
}
