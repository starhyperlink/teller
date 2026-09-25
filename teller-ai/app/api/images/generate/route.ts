import { InferenceClient } from "@huggingface/inference";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json({ error: "Prompt is required." }, { status: 400 });
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      return Response.json({ error: "HF_TOKEN is not configured." }, { status: 500 });
    }

    const client = new InferenceClient(token);
    const image = await client.textToImage({
      model: "black-forest-labs/FLUX.1-dev",
      prompt,
    });

    const buffer = Buffer.from(await image.arrayBuffer());
    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    return Response.json({ url: dataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
