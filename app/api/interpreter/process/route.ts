import { NextResponse } from "next/server";
import { languages } from "@/lib/languages";
import {
  createSpeech,
  transcribeAudio,
  translateText,
} from "@/lib/openai/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const sourceLanguage = String(formData.get("sourceLanguage") ?? "auto");
    const targetLanguage = String(formData.get("targetLanguage") ?? "en");

    if (!(audio instanceof File)) {
      return errorResponse("An audio recording is required.", 400);
    }

    if (audio.size === 0) {
      return errorResponse("The recording is empty.", 400);
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return errorResponse("Recording is too large. Keep it under 30 seconds.", 413);
    }

    if (sourceLanguage === targetLanguage) {
      return errorResponse("Choose two different languages.", 400);
    }

    const target = languages.find((item) => item.code === targetLanguage);
    const source =
      sourceLanguage === "auto"
        ? null
        : languages.find((item) => item.code === sourceLanguage);

    if (!target) {
      return errorResponse("Unsupported target language.", 400);
    }

    if (sourceLanguage !== "auto" && !source) {
      return errorResponse("Unsupported source language.", 400);
    }

    const transcript = await transcribeAudio({
      file: audio,
      sourceLanguage,
    });

    const translation = await translateText({
      transcript,
      sourceLanguageName: source?.name ?? "Auto detected language",
      targetLanguageName: target.name,
    });

    const audioBase64 = await createSpeech({
      text: translation,
      targetLanguageName: target.name,
    });

    return NextResponse.json({
      transcript,
      translation,
      detectedLanguage: source?.code ?? null,
      audioBase64,
      audioMimeType: "audio/mpeg",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Interpreter processing failed.";

    console.error("Interpreter API error:", error);
    return errorResponse(message, 500);
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
