import { NextResponse } from "next/server";
import { getLanguageName } from "@/lib/languages";
import { createSpeech } from "@/lib/openai/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedVoices = new Set(["cedar", "marin", "sage"]);

export async function POST(request: Request) {
  try {
    const { text, language, voice } = (await request.json()) as {
      text?: string;
      language?: string;
      voice?: string;
    };

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Message text is empty." },
        { status: 400 },
      );
    }

    const audioBase64 = await createSpeech({
      text: text.trim(),
      targetLanguageName: getLanguageName(language ?? "en"),
      voice: allowedVoices.has(voice ?? "") ? voice : undefined,
    });

    return NextResponse.json({
      audioBase64,
      audioMimeType: "audio/mpeg",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
