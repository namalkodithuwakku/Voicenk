const OPENAI_BASE_URL = "https://api.openai.com/v1";

const transcriptionPrompts: Record<string, string> = {
  si:
    "The speaker is speaking Sinhala. Transcribe accurately in Sinhala script. " +
    "Expect Sri Lankan names, hotel names, room types, dates, times, prices, " +
    "booking references, phone numbers, and mixed English words.",

  ta:
    "The speaker is speaking Tamil. Transcribe accurately in Tamil script. " +
    "Expect Sri Lankan names, hotel names, room types, dates, times, prices, " +
    "booking references, phone numbers, and mixed English words.",
};

export function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Add OPENAI_API_KEY to the active project's .env.local file, then stop and restart npm run dev.",
    );
  }

  if (!apiKey.startsWith("sk-")) {
    throw new Error(
      "OPENAI_API_KEY does not look valid. Check the value in .env.local, then restart npm run dev.",
    );
  }

  return {
    apiKey,
    transcribeModel:
      process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
    translateModel: process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-5-mini",
    ttsModel: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
    ttsVoice: process.env.OPENAI_TTS_VOICE ?? "marin",
  };
}

export async function transcribeAudio(params: {
  file: File;
  sourceLanguage: string;
}) {
  const config = getOpenAIConfig();
  const body = new FormData();

  body.set("file", params.file);
  body.set("model", config.transcribeModel);
  body.set("response_format", "json");

  const transcriptionPrompt =
    transcriptionPrompts[params.sourceLanguage];

  if (
    params.sourceLanguage !== "auto" &&
    !transcriptionPrompt
  ) {
    body.set("language", params.sourceLanguage);
  }

  if (transcriptionPrompt) {
    body.set("prompt", transcriptionPrompt);
  }

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(getOpenAIError(data, "Speech recognition failed."));
  }

  const text =
    typeof data === "object" &&
    data &&
    "text" in data &&
    typeof data.text === "string"
      ? data.text.trim()
      : "";

  if (!text) {
    throw new Error("No clear speech was detected. Please try again.");
  }

  return text;
}

export async function translateText(params: {
  transcript: string;
  sourceLanguageName: string;
  targetLanguageName: string;
}) {
  const config = getOpenAIConfig();

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.translateModel,
      max_output_tokens: 600,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are Voicenk's translation engine. Translate accurately and naturally. " +
                "Preserve names, hotel names, room types, dates, times, phone numbers, amounts, " +
                "currencies, booking IDs, and quantities exactly. Do not explain, annotate, quote, " +
                "or add information. Return only the translated text.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Source language: ${params.sourceLanguageName}`,
                `Target language: ${params.targetLanguageName}`,
                "Text:",
                params.transcript,
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(getOpenAIError(data, "Translation failed."));
  }

  const text = extractResponseText(data).trim();

  if (!text) {
    throw new Error("The translation service returned an empty result.");
  }

  return text;
}

export async function createSpeech(params: {
  text: string;
  targetLanguageName: string;
  voice?: string;
}) {
  const config = getOpenAIConfig();

  const response = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: params.voice ?? config.ttsVoice,
      input: params.text.slice(0, 4096),
      response_format: "mp3",
      instructions:
        `Speak naturally and clearly in ${params.targetLanguageName}. ` +
        "Use a warm, helpful interpreter tone. Preserve the intended meaning and pronunciation.",
    }),
  });

  if (!response.ok) {
    const data = await readJsonResponse(response);

    throw new Error(
      getOpenAIError(data, "Voice generation failed."),
    );
  }

  return Buffer.from(
    await response.arrayBuffer(),
  ).toString("base64");
}

async function readJsonResponse(
  response: Response,
): Promise<unknown> {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getOpenAIError(
  data: unknown,
  fallback: string,
) {
  if (
    typeof data === "object" &&
    data &&
    "error" in data &&
    typeof data.error === "object" &&
    data.error &&
    "message" in data.error &&
    typeof data.error.message === "string"
  ) {
    return data.error.message;
  }

  return fallback;
}

function extractResponseText(data: unknown) {
  if (
    typeof data === "object" &&
    data &&
    "output_text" in data &&
    typeof data.output_text === "string"
  ) {
    return data.output_text;
  }

  if (
    typeof data !== "object" ||
    !data ||
    !("output" in data) ||
    !Array.isArray(data.output)
  ) {
    return "";
  }

  const parts: string[] = [];

  for (const item of data.output) {
    if (
      typeof item !== "object" ||
      !item ||
      !("content" in item) ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        typeof content === "object" &&
        content &&
        "text" in content &&
        typeof content.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("");
}