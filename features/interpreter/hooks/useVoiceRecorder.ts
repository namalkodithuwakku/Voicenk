"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupportedAudioMimeType } from "@/lib/audio";

const MAX_RECORDING_MS = 30_000;
const MIN_RECORDING_MS = 700;

type StopResult = {
  blob: Blob;
  durationMs: number;
};

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionError, setPermissionError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolverRef = useRef<((result: StopResult) => void) | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (isRecording) return false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setPermissionError("Voice recording is not supported in this browser.");
      return false;
    }

    setPermissionError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setDurationMs(0);

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        const duration = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });

        cleanupTimers();
        cleanupStream();
        setIsRecording(false);
        setDurationMs(duration);

        stopResolverRef.current?.({ blob, durationMs: duration });
        stopResolverRef.current = null;
      });

      recorder.start(200);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 100);

      maxTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);

      return true;
    } catch {
      cleanupTimers();
      cleanupStream();
      setPermissionError(
        "Microphone access was denied. Allow microphone permission and try again.",
      );
      return false;
    }
  }, [cleanupStream, cleanupTimers, isRecording]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state !== "recording") {
      return null;
    }

    const resultPromise = new Promise<StopResult>((resolve) => {
      stopResolverRef.current = resolve;
    });

    recorder.stop();
    const result = await resultPromise;

    if (result.durationMs < MIN_RECORDING_MS) {
      setPermissionError("That was too short. Hold the microphone and speak again.");
      return null;
    }

    return result;
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopResolverRef.current = null;

    if (recorder?.state === "recording") {
      recorder.stop();
    }

    cleanupTimers();
    cleanupStream();
    chunksRef.current = [];
    setIsRecording(false);
    setDurationMs(0);
  }, [cleanupStream, cleanupTimers]);

  useEffect(() => {
    return () => {
      cleanupTimers();
      cleanupStream();
    };
  }, [cleanupStream, cleanupTimers]);

  return {
    isRecording,
    durationMs,
    permissionError,
    clearPermissionError: () => setPermissionError(""),
    start,
    stop,
    cancel,
  };
}
