import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-management";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const TRANSCRIPTION_MAX_TOKENS = Number.parseInt(process.env.TRANSCRIPTION_MAX_TOKENS || "403", 10);
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-wav",
]);

export async function POST(request: Request) {
  if (!(await getAuthenticatedUserId(request))) {
    return NextResponse.json({ error: "Sign in to use voice input." }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice transcription is not configured." }, { status: 503 });
  }

  let audio: FormDataEntryValue | null;
  try {
    audio = (await request.formData()).get("audio");
  } catch {
    return NextResponse.json({ error: "The audio recording could not be read." }, { status: 400 });
  }

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Record a message before sending." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "The recording is too large. Keep it under 20 MB." }, { status: 413 });
  }

  const mimeType = audio.type.split(";")[0].trim().toLowerCase();
  if (!SUPPORTED_AUDIO_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "This audio format is not supported." }, { status: 415 });
  }

  try {
    const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/danielrosehill/OR-Audio-Transcription-MCP",
        "X-Title": "Teller AI Voice Input",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: Number.isInteger(TRANSCRIPTION_MAX_TOKENS) && TRANSCRIPTION_MAX_TOKENS > 0
          ? TRANSCRIPTION_MAX_TOKENS
          : 403,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this speech into clean, readable text. Add punctuation, remove filler words and false starts, and return only the transcription.",
              },
              {
                type: "audio_url",
                audio_url: { url: `data:${mimeType};base64,${audioBase64}` },
              },
            ],
          },
        ],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const providerError = typeof result.error?.message === "string" ? result.error.message : "";
      console.error("OpenRouter transcription error:", providerError || response.status);
      if (/more credits|can only afford/i.test(providerError)) {
        return NextResponse.json(
          { error: "OpenRouter has insufficient credits for this recording. Try a shorter recording or add credits." },
          { status: 402 },
        );
      }
      return NextResponse.json({ error: "Transcription failed. Please try again." }, { status: 502 });
    }

    const transcription = result.choices?.[0]?.message?.content;
    if (typeof transcription !== "string" || !transcription.trim()) {
      return NextResponse.json({ error: "No speech was detected. Try speaking again." }, { status: 422 });
    }

    return NextResponse.json({ transcription: transcription.trim() });
  } catch (error) {
    console.error("Audio transcription request failed:", error);
    return NextResponse.json({ error: "Transcription failed. Please try again." }, { status: 502 });
  }
}