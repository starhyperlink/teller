import { NextResponse } from "next/server";
import { callTellerAI, type TellerAccountContext } from "@/lib/ai";
import { getAuth0User, getAuthenticatedUserId } from "@/lib/auth0-management";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { getPlanKey, plans } from "@/lib/plans";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    let accountContext: TellerAccountContext | undefined;
    const userId = await getAuthenticatedUserId(req);
    if (userId) {
      const user = await getAuth0User(userId);
      const metadata = user.app_metadata || {};
      const planKey = getPlanKey(metadata.plan) || "free";
      const plan = plans[planKey];
      const usageMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
      const { firestore } = getFirebaseAdmin();
      const usageSnapshot = await firestore
        .collection("users")
        .doc(encodeURIComponent(userId))
        .collection("account")
        .doc("usage")
        .get();
      const usageData = usageSnapshot.data();
      const usageCount = usageData?.usageMonth === usageMonth ? Number(usageData.usageCount || 0) : 0;

      if (usageCount >= plan.usageLimit) {
        return NextResponse.json(
          { error: `You have reached the ${plan.name} plan limit of ${plan.usageLimit} chats this month.` },
          { status: 429 },
        );
      }

      accountContext = {
        name: user.name || user.nickname || user.email || "Teller User",
      };
    }

    const reply = await callTellerAI(messages, accountContext);

      // Ask the AI for a short title summarizing the conversation
      let title: string | null = null;
      try {
        const titlePrompt = `Please provide a concise title (no more than 6 words) that summarizes the conversation so far. Return ONLY the title on a single line.`;
        const titleResult = await callTellerAI([
          ...messages,
          { role: "user", content: titlePrompt },
        ], accountContext);

        // sanitize titleResult to a single line and reasonable length
        if (titleResult) {
          title = titleResult.split("\n")[0].slice(0, 100).trim();
        }
      } catch (e) {
        // ignore title errors
      }

      return NextResponse.json({ reply, title });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
