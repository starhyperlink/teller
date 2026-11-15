import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAuthenticatedUserId } from "@/lib/auth0-auth";
import {
  deleteUserProfilePicture,
  saveUserProfilePicture,
} from "@/lib/postgres";
import {
  MAX_PROFILE_PICTURE_BYTES,
  PROFILE_PICTURE_TYPES,
} from "@/lib/profile-picture";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_PROFILE_PICTURE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Profile pictures must be 5 MB or smaller." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a valid image file." }, { status: 400 });
  }

  const file = formData.get("profilePicture");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The selected image is empty." }, { status: 400 });
  }
  if (file.size > MAX_PROFILE_PICTURE_BYTES) {
    return NextResponse.json({ error: "Profile pictures must be 5 MB or smaller." }, { status: 413 });
  }
  if (!PROFILE_PICTURE_TYPES.includes(file.type as (typeof PROFILE_PICTURE_TYPES)[number])) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  }

  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "The uploaded file is not a supported image." }, { status: 400 });
  }

  try {
    await saveUserProfilePicture(userId, image);
  } catch (error) {
    console.error("Profile picture upload error:", error);
    return NextResponse.json({ error: "Could not save your profile picture." }, { status: 500 });
  }

  return NextResponse.json({
    picture: `data:image/webp;base64,${image.toString("base64")}`,
    hasCustomPicture: true,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await deleteUserProfilePicture(userId);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Profile picture removal error:", error);
    return NextResponse.json({ error: "Could not remove your profile picture." }, { status: 500 });
  }
}
