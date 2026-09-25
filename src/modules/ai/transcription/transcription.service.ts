import { env } from "../../../config/env.js";

export type TranscriptionInput = {
  data: Buffer;
  filename: string;
  mimeType: string;
};

export type TranscriptionResult = {
  text: string;
  language?: string;
  durationSeconds?: number;
};

type TranscriptionResponse = {
  text?: string;
  language?: string;
  duration?: number;
};

export async function transcribeAudio(
  input: TranscriptionInput,
): Promise<TranscriptionResult> {
  const apiKey = env.TRANSCRIPTION_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TRANSCRIPTION_API_KEY is not configured. Set a Speech-to-Text provider before sending voice messages.",
    );
  }

  const baseUrl = (
    env.TRANSCRIPTION_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = env.TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe";

  const form = new FormData();
  form.append("model", model);
  form.append(
    "file",
    new Blob([new Uint8Array(input.data)], { type: input.mimeType }),
    input.filename,
  );

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transcription API error ${response.status}: ${text}`);
  }

  const result = (await response.json()) as TranscriptionResponse;

  if (!result.text) {
    throw new Error("Transcription API returned an empty transcript");
  }

  return {
    text: result.text,
    language: result.language,
    durationSeconds: result.duration,
  };
}
