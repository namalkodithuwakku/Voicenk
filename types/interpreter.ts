export type InterpreterStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "processing"
  | "ready"
  | "error";

export type InterpreterResult = {
  transcript: string;
  translation: string;
  detectedLanguage: string | null;
  audioBase64: string;
  audioMimeType: string;
};
