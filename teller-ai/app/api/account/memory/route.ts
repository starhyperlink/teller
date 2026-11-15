import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-auth";
import {
  addUserMemory,
  deleteAllUserMemories,
  deleteUserMemory,
  getUserMemories,
} from "@/lib/postgres";
import { MAX_USER_MEMORY_CHARS } from "@/lib/user-memory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    return NextResponse.json({ memories: await getUserMemories(userId) });
  } catch (error) {
    console.error("Could not load user memories:", error);
    return NextResponse.json({ error: "Could not load saved memories." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Provide a memory to save." }, { status: 400 });
  }

  try {
    const memory = body && typeof body === "object" && "memory" in body &&
      typeof body.memory === "string"
      ? body.memory.trim().replace(/\s+/g, " ")
      : "";
    if (!memory) {
      return NextResponse.json({ error: "Enter a memory to save." }, { status: 400 });
    }
    if (memory.length > MAX_USER_MEMORY_CHARS) {
      return NextResponse.json(
        { error: `Keep each memory under ${MAX_USER_MEMORY_CHARS} characters.` },
        { status: 413 },
      );
    }

    const status = await addUserMemory(userId, memory);
    if (status === "duplicate") {
      return NextResponse.json({ error: "That memory is already saved." }, { status: 409 });
    }
    if (status === "limit") {
      return NextResponse.json({ error: "Delete a saved memory before adding another." }, { status: 409 });
    }

    const memories = await getUserMemories(userId);
    return NextResponse.json({ memories });
  } catch (error) {
    console.error("Could not save user memory:", error);
    return NextResponse.json({ error: "Could not save that memory." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Provide a saved memory to delete." }, { status: 400 });
  }

  try {
    if (body && typeof body === "object" && "clearAll" in body && body.clearAll === true) {
      return NextResponse.json({ deleted: await deleteAllUserMemories(userId) });
    }

    const id = body && typeof body === "object" && "id" in body &&
      typeof body.id === "string"
      ? body.id
      : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Choose a valid saved memory." }, { status: 400 });
    }
    if (!await deleteUserMemory(userId, id)) {
      return NextResponse.json({ error: "That saved memory was not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error("Could not delete user memory:", error);
    return NextResponse.json({ error: "Could not delete saved memories." }, { status: 500 });
  }
}
