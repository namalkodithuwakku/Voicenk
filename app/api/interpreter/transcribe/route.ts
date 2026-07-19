import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/openai/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const sourceLanguage = String(formData.get("sourceLanguage") ?? "auto");

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "A voice recording is required." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Keep recordings under 30 seconds." }, { status: 413 });
    }

    const transcript = await transcribeAudio({ file: audio, sourceLanguage });
    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
