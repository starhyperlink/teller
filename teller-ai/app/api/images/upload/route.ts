import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { generatedImagesBucket, supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const maxImageSize = 10 * 1024 * 1024;

function extensionForContentType(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "png";
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    if (typeof body.imageUrl !== "string" || !body.imageUrl) {
      return NextResponse.json({ error: "An image URL is required." }, { status: 400 });
    }

    const imageResponse = await fetch(body.imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Could not download the generated image." }, { status: 400 });
    }

    const contentType = imageResponse.headers.get("content-type")?.split(";", 1)[0] || "image/png";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "The generated file is not an image." }, { status: 400 });
    }

    const contentLength = Number(imageResponse.headers.get("content-length"));
    if (contentLength > maxImageSize) {
      return NextResponse.json({ error: "The generated image is too large." }, { status: 413 });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBuffer.length > maxImageSize) {
      return NextResponse.json({ error: "The generated image is too large." }, { status: 413 });
    }

    const path = `${userId}/${crypto.randomUUID()}.${extensionForContentType(contentType)}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(generatedImagesBucket)
      .upload(path, imageBuffer, { contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from(generatedImagesBucket).getPublicUrl(path);
    return NextResponse.json({ imageUrl: data.publicUrl, path });
  } catch (error) {
    console.error("Image upload API error:", error);
    return NextResponse.json({ error: "Could not save the generated image." }, { status: 500 });
  }
}