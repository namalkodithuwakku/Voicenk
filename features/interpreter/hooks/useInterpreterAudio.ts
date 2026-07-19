"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { base64ToObjectUrl } from "@/lib/audio";

export function useInterpreterAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef("");
  const [isPlaying, setIsPlaying] = useState(false);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }, []);

  const loadAndPlay = useCallback(
    async (base64: string, mimeType: string, autoplay = true) => {
      stop();

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = base64ToObjectUrl(base64, mimeType);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("play", () => setIsPlaying(true));
      audio.addEventListener("pause", () => setIsPlaying(false));
      audio.addEventListener("ended", () => setIsPlaying(false));

      if (autoplay) {
        try {
          await audio.play();
        } catch {
          setIsPlaying(false);
        }
      }
    },
    [stop],
  );

  const replay = useCallback(async () => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = 0;

    try {
      await audioRef.current.play();
    } catch {
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return { isPlaying, loadAndPlay, replay, stop };
}
