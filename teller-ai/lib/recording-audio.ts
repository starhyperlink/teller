const TRANSCRIPTION_SAMPLE_RATE = 16_000;

export function encodeAudioChunksToWav(chunks: readonly Float32Array[], sourceSampleRate: number) {
  if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new Error("The microphone returned an invalid audio sample rate.");
  }
  const sourceLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  if (!sourceLength) throw new Error("No audio was captured.");

  const source = new Float32Array(sourceLength);
  let sourceOffset = 0;
  for (const chunk of chunks) {
    source.set(chunk, sourceOffset);
    sourceOffset += chunk.length;
  }

  const sampleRate = Math.min(sourceSampleRate, TRANSCRIPTION_SAMPLE_RATE);
  const sampleStep = sourceSampleRate / sampleRate;
  const sampleCount = Math.ceil(sourceLength / sampleStep);
  const wav = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(wav);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const sourcePosition = index * sampleStep;
    const lower = Math.floor(sourcePosition);
    const upper = Math.min(lower + 1, sourceLength - 1);
    const fraction = sourcePosition - lower;
    const sample = source[lower] * (1 - fraction) + source[upper] * fraction;
    const pcm = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, pcm < 0 ? pcm * 0x8000 : pcm * 0x7fff, true);
  }

  return new Blob([wav], { type: "audio/wav" });
}
