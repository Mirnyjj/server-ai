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

type WhisperResponse = {
  text: string;
  language?: string;
  duration?: number;
};

export async function transcribeAudio(
  input: TranscriptionInput,
): Promise<TranscriptionResult> {
  const baseUrl = (
    env.WHISPER_BASE_URL ?? "http://whisper:8001"
  ).replace(/\/$/, "");

  const form = new FormData();

  form.append(
    "file",
    new Blob([new Uint8Array(input.data)], {
      type: input.mimeType,
    }),
    input.filename,
  );

  const response = await fetch(`${baseUrl}/transcribe`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Whisper service error ${response.status}: ${errorText}`,
    );
  }

  const result = (await response.json()) as WhisperResponse;

  if (!result.text?.trim()) {
    throw new Error("Whisper returned an empty transcript");
  }

  return {
    text: result.text.trim(),
    language: result.language,
    durationSeconds: result.duration,
  };
}
