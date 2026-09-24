import { NextResponse } from "next/server";
import { generateImageWithHuggingFaceMcp } from "@/lib/huggingface-mcp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt || prompt.length > 2_000) {
      return NextResponse.json({ error: "Enter a prompt up to 2,000 characters." }, { status: 400 });
    }

    const image = await generateImageWithHuggingFaceMcp(prompt);
    return NextResponse.json({ image });
  } catch (error) {
    console.error("Image generation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 500 },
    );
  }
}