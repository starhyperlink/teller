import { NextResponse } from "next/server";
import { generateImageWithOpenRouter } from "@/lib/openrouter-image";
import { MAX_IMAGE_BYTES, parseImageDataUrl } from "@/lib/image-input";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { saveUserChatMedia } from "@/lib/postgres";

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
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Log in to generate and save images." }, { status: 401 });
    }

    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const resolution = typeof body.resolution === "string" ? body.resolution : "";
    const referenceImage = body.referenceImage;

    if (!prompt || prompt.length > 1500) {
      return NextResponse.json(
        { error: "Enter a prompt up to 1,500 characters long." },
        { status: 400 },
      );
    }
    if (resolution && !resolutions.has(resolution)) {
      return NextResponse.json({ error: "Choose a supported image size." }, { status: 400 });
    }
    if (referenceImage !== undefined && typeof referenceImage !== "string") {
      return NextResponse.json({ error: "The reference image is invalid." }, { status: 400 });
    }
    const parsedReference = referenceImage ? parseImageDataUrl(referenceImage) : null;
    if (referenceImage && !parsedReference) {
      const encodedImage = referenceImage.match(/^data:image\/[^;,]+;base64,([\s\S]*)$/i);
      if (encodedImage && encodedImage[1].length > (MAX_IMAGE_BYTES * 4) / 3) {
        return NextResponse.json(
          { error: "Keep reference images under 3 MB." },
          { status: 413 },
        );
      }
      return NextResponse.json(
        { error: "Upload a JPEG, PNG, or WebP image under 3 MB." },
        { status: 400 },
      );
    }
    if (!process.env.OPENROUTER_API_KEY || !process.env.IMAGE_GENERATION_MODEL?.trim()) {
      return NextResponse.json(
        { error: "Image generation is not configured on the server." },
        { status: 503 },
      );
    }

    const image = await generateImageWithOpenRouter(prompt, resolution, parsedReference?.dataUrl);
    const dataUrl = image.imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!dataUrl) {
      return NextResponse.json(
        { error: "The image provider returned an image format that cannot be stored." },
        { status: 502 },
      );
    }

    const imageBytes = Buffer.from(dataUrl[2], "base64");
    const mediaId = await saveUserChatMedia(
      userId,
      typeof body.historyId === "string" ? body.historyId.slice(0, 100) : "generated",
      "generated-image",
      dataUrl[1],
      imageBytes,
    );
    return NextResponse.json({
      imageUrl: `data:${dataUrl[1]};base64,${imageBytes.toString("base64")}`,
      imageStoragePath: `postgres:${mediaId}`,
      prompt: image.prompt,
    });
  } catch (error) {
    console.error("Image generation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 502 },
    );
  }
}