import { NextResponse } from "next/server";
import { getLanguageName } from "@/lib/languages";
import { createSpeech } from "@/lib/openai/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { text, language } = (await request.json()) as { text?: string; language?: string };
    if (!text?.trim()) return NextResponse.json({ error: "Message text is empty." }, { status: 400 });
    const audioBase64 = await createSpeech({
      text: text.trim(),
      targetLanguageName: getLanguageName(language ?? "en"),
    });
    return NextResponse.json({ audioBase64, audioMimeType: "audio/mpeg" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
