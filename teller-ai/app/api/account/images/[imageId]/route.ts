import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { getUserGeneratedImage } from "@/lib/postgres";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { imageId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(imageId)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  try {
    const image = await getUserGeneratedImage(userId, imageId);
    if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });

    return new Response(new Uint8Array(image.mediaData), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, no-store",
        "Content-Length": String(image.mediaData.length),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Generated image retrieval API error:", error);
    return NextResponse.json({ error: "Could not load this generated image." }, { status: 500 });
  }
}
