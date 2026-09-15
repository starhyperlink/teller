import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const usageMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
    const { firestore } = getFirebaseAdmin();
    const usageDocument = firestore
      .collection("users")
      .doc(encodeURIComponent(userId))
      .collection("account")
      .doc("usage");

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageDocument);
      const data = snapshot.data();
      const currentCount = data?.usageMonth === usageMonth ? Number(data.usageCount || 0) : 0;
      transaction.set(usageDocument, {
        usageMonth,
        usageCount: currentCount + 1,
        updatedAt: Date.now(),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account usage API error:", error);
    return NextResponse.json({ error: "Could not update account usage." }, { status: 500 });
  }
}