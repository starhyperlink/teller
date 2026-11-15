const OPENROUTER_TTS_URL = "https://openrouter.ai/api/v1/audio/speech";
const OPENROUTER_TTS_MODEL = "heygen/heygen-voice-1-turbo:free";
const OPENROUTER_TTS_TIMEOUT_MS = 60_000;

export async function synthesizeWithOpenRouter(text: string, apiKey: string) {
  const response = await fetch(OPENROUTER_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model: OPENROUTER_TTS_MODEL,
      input: text,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(OPENROUTER_TTS_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    console.error("OpenRouter speech generation failed:", response.status, detail);
    if (response.status === 401 || response.status === 403) {
      throw new Error("OpenRouter denied the speech request. Verify OPENROUTER_API_KEY.");
    }
    if (response.status === 402) {
      throw new Error("OpenRouter requires available account credits for speech generation.");
    }
    if (response.status === 429) {
      throw new Error("OpenRouter speech rate limit reached. Try again later.");
    }
    if (response.status >= 500) {
      throw new Error(`OpenRouter speech generation is temporarily unavailable (HTTP ${response.status}).`);
    }
    throw new Error(
      `OpenRouter rejected the speech request (HTTP ${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) throw new Error("OpenRouter returned no audio data.");
  return audio;
}
