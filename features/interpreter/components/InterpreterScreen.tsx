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

export function InterpreterScreen() {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("fr");
  const [pickerSide, setPickerSide] = useState<PickerSide>(null);
  const [status, setStatus] = useState<InterpreterStatus>("idle");
  const [result, setResult] = useState<InterpreterResult | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const recorder = useVoiceRecorder();
  const player = useInterpreterAudio();

  const sourceLabel =
    sourceLanguage === "auto" ? "Auto detect" : getLanguageName(sourceLanguage);
  const targetLabel = getLanguageName(targetLanguage);

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
        await player.loadAndPlay(
          data.audioBase64,
          data.audioMimeType,
          true,
        );
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

  async function startRecording(event: ReactPointerEvent<HTMLButtonElement>) {
    if (status === "processing") return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    recorder.clearPermissionError();
    setError("");
    setResult(null);
    player.stop();
    setStatus("requesting_permission");

    const started = await recorder.start();
    setStatus(started ? "recording" : "error");
  }

  async function finishRecording() {
    if (!recorder.isRecording) return;

    const recording = await recorder.stop();

    if (!recording) {
      setStatus("error");
      return;
    }

    await processRecording(recording.blob);
  }

  function swapLanguages() {
    if (status === "recording" || status === "processing") return;

    const nextSource =
      sourceLanguage === "auto" ? targetLanguage : targetLanguage;
    const nextTarget =
      sourceLanguage === "auto" ? "en" : sourceLanguage;

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
          : result
            ? "Hold to speak again"
            : "Hold to speak";

  return (
    <section className="py-6">
      <div className="rounded-[2rem] bg-foreground p-6 text-white shadow-[var(--shadow-soft)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
          Interpreter · No account needed
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.04em]">
          Speak naturally. Let Voicenk handle the language.
        </h1>
        <p className="mt-4 text-sm font-medium leading-6 text-white/65">
          Hold the microphone, speak, then release. The translation appears and
          plays automatically.
        </p>
      </div>

      <div className="mt-5 rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
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
            className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-strong disabled:opacity-40"
          >
            <SwapIcon className="h-5 w-5" />
          </button>

          <LanguageButton
            label="Listener"
            language={targetLabel}
            onClick={() => setPickerSide("target")}
          />
        </div>

        <button
          type="button"
          onPointerDown={(event) => void startRecording(event)}
          onPointerUp={() => void finishRecording()}
          onPointerCancel={() => void finishRecording()}
          onContextMenu={(event) => event.preventDefault()}
          disabled={status === "processing"}
          className={`mt-8 flex min-h-24 w-full touch-none select-none items-center justify-center gap-3 rounded-[1.8rem] px-6 font-black shadow-lg transition active:scale-[0.985] disabled:cursor-wait ${
            status === "recording"
              ? "animate-pulse bg-red-500 text-white"
              : status === "processing"
                ? "bg-surface-soft text-muted"
                : "bg-accent text-foreground"
          }`}
        >
          <MicrophoneIcon className="h-7 w-7" />
          {micLabel}
        </button>

        <p className="mt-4 text-center text-xs font-bold text-muted">
          Maximum recording: 30 seconds
        </p>

        {visibleError && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
            {visibleError}
          </div>
        )}

        {result && (
          <InterpreterResultCard
            result={result}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
            isPlaying={player.isPlaying}
            onReplay={() => void player.replay()}
            onStop={player.stop}
            onClear={clearResult}
          />
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
      className="min-w-0 rounded-2xl bg-surface-soft px-3 py-4 text-left transition hover:bg-accent-soft"
    >
      <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-black text-foreground">
        {language}
      </span>
    </button>
  );
}
