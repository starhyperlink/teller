import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { saveUserUsage } from "@/lib/postgres";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { usageCount } = await request.json();
    if (!Number.isInteger(usageCount) || usageCount < 0) {
      return NextResponse.json({ error: "Invalid usage count." }, { status: 400 });
    }

    const usageMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
    await saveUserUsage(userId, usageCount, usageMonth);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account usage API error:", error);
    return NextResponse.json({ error: "Could not update account usage." }, { status: 500 });
  }
}