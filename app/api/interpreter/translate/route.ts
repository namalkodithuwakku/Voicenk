import { NextResponse } from "next/server";
import { languages } from "@/lib/languages";
import { createSpeech, translateText } from "@/lib/openai/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string;
      sourceLanguage?: string;
      targetLanguage?: string;
      includeVoice?: boolean;
    };
    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: "Enter text to translate." }, { status: 400 });

    const source = languages.find((item) => item.code === body.sourceLanguage);
    const target = languages.find((item) => item.code === body.targetLanguage);
    if (!target) return NextResponse.json({ error: "Choose a target language." }, { status: 400 });

    const translation = await translateText({
      transcript: text,
      sourceLanguageName: source?.name ?? "Auto detected language",
      targetLanguageName: target.name,
    });

    const audioBase64 = body.includeVoice === false
      ? ""
      : await createSpeech({ text: translation, targetLanguageName: target.name });

    return NextResponse.json({ translation, audioBase64, audioMimeType: "audio/mpeg" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
