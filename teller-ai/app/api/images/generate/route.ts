import { NextResponse } from "next/server";
import { generateImageWithMcp } from "@/lib/hf-image-mcp";
import { saveGeneratedImage } from "@/lib/postgres";

export const runtime = "nodejs";

const resolutions = new Set([
  "1024x1024 ( 1:1 )",
  "1152x896 ( 9:7 )",
  "896x1152 ( 7:9 )",
  "1152x864 ( 4:3 )",
  "864x1152 ( 3:4 )",
  "1248x832 ( 3:2 )",
  "832x1248 ( 2:3 )",
  "1280x720 ( 16:9 )",
  "720x1280 ( 9:16 )",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const resolution = typeof body.resolution === "string" ? body.resolution : "";

    if (!prompt || prompt.length > 1500) {
      return NextResponse.json(
        { error: "Enter a prompt up to 1,500 characters long." },
        { status: 400 },
      );
    }
    if (resolution && !resolutions.has(resolution)) {
      return NextResponse.json({ error: "Choose a supported image size." }, { status: 400 });
    }

    const image = await generateImageWithMcp(prompt, resolution);
    const imageId = await saveGeneratedImage(image.prompt, image.imageUrl);
    return NextResponse.json({
      prompt: image.prompt,
      imageUrl: `/api/images/${imageId}`,
    });
  } catch (error) {
    console.error("Image generation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 502 },
    );
  }
}