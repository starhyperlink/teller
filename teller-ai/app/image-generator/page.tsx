"use client";

import { useState } from "react";

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateImage() {
    setLoading(true);
    setError("");
    setImage(null);
    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Image generation failed.");
      setImage(data.image);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Image generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-sky-300">
          Teller AI
        </p>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Image generator
        </h1>
        <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); void generateImage(); }}>
          <label htmlFor="image-prompt" className="sr-only">Image prompt</label>
          <textarea id="image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the image you want to create..." className="min-h-32 w-full rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-white outline-none ring-sky-400 placeholder:text-neutral-500 focus:ring-2" />
          <button type="submit" disabled={loading || !prompt.trim()} className="rounded-xl bg-sky-400 px-5 py-3 font-semibold text-neutral-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Generating..." : "Generate image"}
          </button>
        </form>
        {error && <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {image && <img src={image} alt={prompt} className="mt-8 w-full rounded-xl border border-neutral-800" />}
      </div>
    </main>
  );
}
