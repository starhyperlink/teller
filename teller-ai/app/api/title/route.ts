import { NextResponse } from "next/server";
import { callTellerAI, type TellerAccountContext } from "@/lib/ai";
import { getAuth0User, getAuthenticatedUserId } from "@/lib/auth0-management";
import { getPlanKey, plans } from "@/lib/plans";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required." }, { status: 400 });
    }

    const titlePrompt = `Please provide a concise title (no more than 6 words) that summarizes the conversation so far. Return ONLY the title on a single line.`;
    let accountContext: TellerAccountContext | undefined;
    const userId = await getAuthenticatedUserId(req);
    if (userId) {
      const user = await getAuth0User(userId);
      const metadata = user.app_metadata || {};
      const planKey = getPlanKey(metadata.plan) || "free";
      const plan = plans[planKey];
      const usageMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
      const usageCount = metadata.usage_month === usageMonth ? Number(metadata.usage_count || 0) : 0;
      accountContext = {
        name: user.name || user.nickname || user.email || "Teller User",
        plan: plan.name,
        usageCount,
        usageLimit: plan.usageLimit,
      };
    }

    const titleResult = await callTellerAI(
      [...messages, { role: "user", content: titlePrompt }],
      accountContext,
    );

    const title = titleResult ? titleResult.split("\n")[0].slice(0, 100).trim() : null;

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title API error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
