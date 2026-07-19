"use client";

import { useState } from "react";
import { MicrophoneIcon, SwapIcon } from "@/components/ui/Icons";
import { getLanguageName } from "@/lib/languages";
import { formatRecordingTime } from "@/lib/audio";
import { LanguagePicker } from "@/features/interpreter/components/LanguagePicker";
import { useVoiceRecorder } from "@/features/interpreter/hooks/useVoiceRecorder";
import { useInterpreterAudio } from "@/features/interpreter/hooks/useInterpreterAudio";

type PickerSide = "source" | "target" | null;
type Stage = "idle" | "recording" | "transcribing" | "review" | "translating" | "ready";

export function InterpreterScreen() {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("si");
  const [pickerSide, setPickerSide] = useState<PickerSide>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const recorder = useVoiceRecorder();
  const player = useInterpreterAudio();

  async function startRecording() {
    if (stage === "transcribing" || stage === "translating") return;
    setError(""); setTranscript(""); setTranslation(""); player.stop();
    const started = await recorder.start();
    if (started) setStage("recording");
  }

  async function stopRecording() {
    const recording = await recorder.stop();
    if (!recording) { setStage("idle"); return; }
    setStage("transcribing");
    const form = new FormData();
    const ext = recording.blob.type.includes("mp4") ? "m4a" : recording.blob.type.includes("ogg") ? "ogg" : "webm";
    form.set("audio", recording.blob, `voicenk.${ext}`);
    form.set("sourceLanguage", sourceLanguage);
    try {
      const response = await fetch("/api/interpreter/transcribe", { method: "POST", body: form });
      const data = await response.json() as { transcript?: string; error?: string };
      if (!response.ok || !data.transcript) throw new Error(data.error ?? "Could not understand the recording.");
      setTranscript(data.transcript); setStage("review");
    } catch (e) { setError(e instanceof Error ? e.message : "Transcription failed."); setStage("idle"); }
  }

  async function translate() {
    if (!transcript.trim()) return;
    setStage("translating"); setError(""); player.stop();
    try {
      const response = await fetch("/api/interpreter/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, sourceLanguage, targetLanguage, includeVoice: true }),
      });
      const data = await response.json() as { translation?: string; audioBase64?: string; audioMimeType?: string; error?: string };
      if (!response.ok || !data.translation) throw new Error(data.error ?? "Translation failed.");
      setTranslation(data.translation); setStage("ready");
      if (data.audioBase64) await player.loadAndPlay(data.audioBase64, data.audioMimeType ?? "audio/mpeg", true);
    } catch (e) { setError(e instanceof Error ? e.message : "Translation failed."); setStage("review"); }
  }

  function reset() { recorder.cancel(); player.stop(); setTranscript(""); setTranslation(""); setError(""); setStage("idle"); }
  function swap() { if (stage === "recording") return; const next = sourceLanguage === "auto" ? "en" : sourceLanguage; setSourceLanguage(targetLanguage); setTargetLanguage(next); reset(); }

  const sourceLabel = sourceLanguage === "auto" ? "Auto detect" : getLanguageName(sourceLanguage);
  const targetLabel = getLanguageName(targetLanguage);

  return (
    <section className="flex h-full min-h-0 flex-col py-3">
      <div className="shrink-0 rounded-[1.5rem] bg-foreground p-4 text-white shadow-[var(--shadow-soft)]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">Interpreter · No account needed</p>
        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-[-0.04em]">Tap, speak, review, then translate.</h1>
        <p className="mt-2 text-xs font-medium leading-5 text-white/65">Correct names, prices or dates before VoiceNK translates them.</p>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]">
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <LanguageButton label="Speaker" language={sourceLabel} onClick={() => setPickerSide("source")} />
          <button type="button" onClick={swap} className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-strong"><SwapIcon className="h-4 w-4" /></button>
          <LanguageButton label="Listener" language={targetLabel} onClick={() => setPickerSide("target")} />
        </div>

        {(stage === "idle" || stage === "recording") && (
          <button type="button" onClick={stage === "recording" ? stopRecording : startRecording}
            className={`mt-4 flex min-h-16 shrink-0 select-none items-center justify-center gap-2.5 rounded-[1.35rem] px-4 text-sm font-black shadow-lg ${stage === "recording" ? "bg-red-500 text-white" : "bg-accent text-foreground"}`}>
            <MicrophoneIcon className="h-5 w-5" />
            {stage === "recording" ? `Tap to stop · ${formatRecordingTime(recorder.durationMs)}` : "Tap to start speaking"}
          </button>
        )}

        {(stage === "transcribing" || stage === "translating") && (
          <div className="mt-4 rounded-2xl bg-accent-soft p-4 text-center text-sm font-black text-accent-strong">
            {stage === "transcribing" ? "Understanding your voice…" : "Translating and preparing voice…"}
          </div>
        )}

        {(stage === "review" || stage === "ready" || stage === "translating") && (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Editable transcript</label>
            <textarea value={transcript} onChange={(e) => { setTranscript(e.target.value); setTranslation(""); if (stage === "ready") setStage("review"); }}
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-border bg-surface-soft p-3 text-sm font-bold leading-6 outline-none focus:border-accent" />
            {translation && <div className="mt-3 rounded-2xl bg-foreground p-4 text-white"><p className="text-[10px] font-black uppercase tracking-widest text-accent">{targetLabel}</p><p className="mt-2 text-lg font-black leading-7">{translation}</p><button type="button" onClick={() => void player.replay()} className="mt-3 rounded-xl bg-accent px-4 py-2 text-xs font-black text-foreground">Play again</button></div>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={reset} className="min-h-12 rounded-xl bg-surface-soft text-sm font-black">Record again</button>
              <button type="button" disabled={!transcript.trim() || stage === "translating"} onClick={translate} className="min-h-12 rounded-xl bg-accent text-sm font-black disabled:opacity-40">Translate</button>
            </div>
          </div>
        )}

        {(error || recorder.permissionError) && <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{error || recorder.permissionError}</div>}
      </div>

      <LanguagePicker open={pickerSide === "source"} title="Speaker language" selectedCode={sourceLanguage} allowAutoDetect onSelect={setSourceLanguage} onClose={() => setPickerSide(null)} />
      <LanguagePicker open={pickerSide === "target"} title="Listener language" selectedCode={targetLanguage} onSelect={(c) => c !== "auto" && setTargetLanguage(c)} onClose={() => setPickerSide(null)} />
    </section>
  );
}

function LanguageButton({ label, language, onClick }: { label: string; language: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-w-0 rounded-xl bg-surface-soft px-2.5 py-2.5 text-left"><span className="block text-[9px] font-black uppercase tracking-[0.1em] text-muted">{label}</span><span className="mt-0.5 block truncate text-xs font-black">{language}</span></button>;
}
