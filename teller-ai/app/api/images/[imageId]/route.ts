import { getGeneratedImage } from "@/lib/postgres";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(imageId)) {
    return new Response("Not found.", { status: 404 });
  }

  try {
    const image = await getGeneratedImage(imageId);
    if (!image) return new Response("Not found.", { status: 404 });
    if (image.sourceUrl) return Response.redirect(image.sourceUrl, 302);
    if (!image.imageData) return new Response("Not found.", { status: 404 });

    return new Response(new Uint8Array(image.imageData), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Generated image lookup error:", error);
    return new Response("Could not load image.", { status: 500 });
  }
}