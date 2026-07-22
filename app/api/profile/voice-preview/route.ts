import { NextResponse } from "next/server";
import { createSpeech } from "@/lib/openai/server";
import { getLanguageName } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedVoices = new Set(["cedar", "marin", "sage"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      voice?: string;
      language?: string;
    };
    const voice = allowedVoices.has(body.voice ?? "")
      ? body.voice!
      : "marin";
    const languageName = getLanguageName(body.language ?? "en");
    const audioBase64 = await createSpeech({
      text: "Hello. This is how your translated VoiceNK messages will sound.",
      targetLanguageName: languageName,
      voice,
    });

    return NextResponse.json({
      audioBase64,
      audioMimeType: "audio/mpeg",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Voice preview failed.",
      },
      { status: 500 },
    );
  }
}
