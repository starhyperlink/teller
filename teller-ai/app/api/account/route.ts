import { NextResponse } from "next/server";
import { getAuth0User, getAuthenticatedUserId } from "@/lib/auth0-management";
import { plans, type PlanKey } from "@/lib/plans";
import { getCurrentUsageMonth, getUserChatData } from "@/lib/postgres";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const user = await getAuth0User(userId);
    const metadata = user.app_metadata || {};
    const metadataPlan = metadata.plan as PlanKey;
    const planKey = metadataPlan in plans ? metadataPlan : "free";
    const plan = plans[planKey];
    const usageMonth = getCurrentUsageMonth();
    const chatData = await getUserChatData(userId);
    const usageCount = chatData?.usageMonth === usageMonth ? chatData.usageCount : 0;

    return NextResponse.json({
      plan: plan.name,
      billingInterval: plan.interval,
      usageLimit: plan.usageLimit,
      usageCount,
    });
  } catch (error) {
    console.error("Account API error:", error);
    return NextResponse.json({ error: "Could not load account." }, { status: 500 });
  }
}