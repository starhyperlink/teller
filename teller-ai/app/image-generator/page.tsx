"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ImageModel = "gpt-image-1-mini" | "gpt-image-1" | "gpt-image-2";
type Quality = "low" | "medium" | "high";
type RatioKey = "square" | "portrait" | "landscape" | "wide";

const ratios: Record<RatioKey, { label: string; value: { w: number; h: number } }> = {
  square: { label: "Square", value: { w: 1024, h: 1024 } },
  portrait: { label: "Portrait", value: { w: 1024, h: 1280 } },
  landscape: { label: "Landscape", value: { w: 1280, h: 1024 } },
  wide: { label: "Wide", value: { w: 1536, h: 864 } },
};

const examples = [
  "A quiet glass greenhouse on Mars at sunrise, editorial photography",
  "A hand-painted travel poster for Cape Town, bold shapes, cobalt and coral",
  "A tiny ramen shop in the rain, cinematic night lighting, detailed illustration",
];

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("gpt-image-1");
  const [quality, setQuality] = useState<Quality>("medium");
  const [ratio, setRatio] = useState<RatioKey>("square");
  const [testMode, setTestMode] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scriptId = "puter-js";
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  async function generateImage() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || loading) return;

    setLoading(true);
    setError(null);
    try {
      const txt2img = window.puter?.ai?.txt2img;
      if (!txt2img) {
        throw new Error("Puter is still loading. Wait a moment and try again.");
      }

      const result = await txt2img(trimmedPrompt, {
        model,
        quality,
        ratio: ratios[ratio].value,
        test_mode: testMode,
      });
      if (!(result instanceof HTMLImageElement) || !result.src) {
        throw new Error("Puter returned an invalid image result.");
      }
      setImage(result.src);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Image generation failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = "teller-generated-image.png";
    link.click();
  }

  return (
    <main className="min-h-screen bg-[#111311] text-[#f4f0e7]">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="relative flex min-h-[54vh] flex-col overflow-hidden border-b border-[#3c4038] bg-[#20251f] p-6 sm:p-10 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-14">
          <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-[#c5d66b]/15 blur-3xl" />
          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="text-sm font-semibold tracking-[0.22em] text-[#d7e688]">TELLER AI</Link>
            <Link href="/chat" className="rounded-full border border-[#65705c] px-4 py-2 text-sm text-[#d8ded0] transition hover:border-[#d7e688] hover:text-[#d7e688]">Back to chat</Link>
          </div>

          <div className="relative z-10 flex flex-1 flex-col justify-center py-14">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.3em] text-[#d7e688]">Puter image studio</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-7xl">Make the picture in your head visible.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#bac1b2]">Describe a scene, choose a frame, and let Puter turn the idea into an image directly in your browser.</p>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-3 border-t border-[#495044] pt-5 text-xs uppercase tracking-[0.16em] text-[#929b8b]">
              <span>Prompt-led</span>
              <span>Browser-native</span>
              <span>Test mode ready</span>
            </div>
          </div>

          <footer className="relative z-10 text-xs text-[#899286]">Powered by <a href="https://developer.puter.com" target="_blank" rel="noreferrer" className="text-[#d7e688] underline underline-offset-4">Puter</a></footer>
        </section>

        <section className="flex flex-col bg-[#111311] p-6 sm:p-10 lg:p-12">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8e978a]">Create an image</p>
            <h2 className="mt-3 text-2xl font-semibold">Your prompt</h2>
          </div>

          <div className="flex flex-1 flex-col">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void generateImage();
              }}
              placeholder="A cinematic still of..."
              className="min-h-40 w-full resize-y rounded-2xl border border-[#41483d] bg-[#1a1e19] p-5 text-base leading-7 text-[#f4f0e7] outline-none transition placeholder:text-[#70796d] focus:border-[#d7e688]"
            />

            <div className="mt-7 space-y-6">
              <div>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8e978a]">Try a prompt</label>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button key={example} type="button" onClick={() => setPrompt(example)} className="rounded-full border border-[#41483d] px-3 py-2 text-left text-xs text-[#b9c2b2] transition hover:border-[#d7e688] hover:text-[#f4f0e7]">{example}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8e978a]">
                  Model
                  <select value={model} onChange={(event) => setModel(event.target.value as ImageModel)} className="mt-2 w-full rounded-xl border border-[#41483d] bg-[#1a1e19] px-3 py-3 text-sm font-normal normal-case tracking-normal text-[#f4f0e7] outline-none focus:border-[#d7e688]">
                    <option value="gpt-image-1-mini">GPT Image Mini</option>
                    <option value="gpt-image-1">GPT Image 1</option>
                    <option value="gpt-image-2">GPT Image 2</option>
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8e978a]">
                  Quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as Quality)} className="mt-2 w-full rounded-xl border border-[#41483d] bg-[#1a1e19] px-3 py-3 text-sm font-normal normal-case tracking-normal text-[#f4f0e7] outline-none focus:border-[#d7e688]">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>

              <div>
                <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-[#8e978a]">Frame</span>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(ratios) as RatioKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setRatio(key)} className={`rounded-xl border px-2 py-3 text-xs transition ${ratio === key ? "border-[#d7e688] bg-[#d7e688] text-[#20251f]" : "border-[#41483d] text-[#b9c2b2] hover:border-[#d7e688]"}`}>{ratios[key].label}</button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#41483d] bg-[#1a1e19] px-4 py-3 text-sm text-[#c4ccc0]">
                <span><span className="block text-sm text-[#f4f0e7]">Test mode</span><span className="mt-1 block text-xs text-[#899286]">Uses a sample image without credits.</span></span>
                <input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} className="h-5 w-5 accent-[#d7e688]" />
              </label>
            </div>

            <button type="button" onClick={() => void generateImage()} disabled={!prompt.trim() || loading} className="mt-8 flex min-h-14 items-center justify-center rounded-xl bg-[#d7e688] px-5 font-semibold text-[#20251f] transition hover:bg-[#e5f39a] disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? "Creating your image..." : "Generate image"}
            </button>

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm leading-6 text-red-200">{error}</p>}

            {image && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-[#41483d] bg-[#1a1e19]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={prompt} className="max-h-[34rem] w-full object-contain" />
                <div className="flex items-center justify-between gap-3 border-t border-[#41483d] p-3">
                  <span className="truncate text-xs text-[#899286]">Generated with {model}</span>
                  <button type="button" onClick={downloadImage} className="rounded-lg border border-[#65705c] px-3 py-2 text-xs font-semibold text-[#d7e688] hover:border-[#d7e688]">Download</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
