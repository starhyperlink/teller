import { NextResponse } from "next/server";
import {
  getAuth0User,
  getAuthenticatedUserId,
  updateAuth0Profile,
} from "@/lib/auth0-management";
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
      name: user.name || "",
      email: user.email || "",
      phone: user.phone_number || "",
      picture: user.picture || "",
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

export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
    }
    if (phone.length > 40) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    await updateAuth0Profile(
      userId,
      phone ? { name, phone_number: phone } : { name },
    );
    return NextResponse.json({ name, phone });
  } catch (error) {
    console.error("Account profile update error:", error);
    return NextResponse.json(
      {
        error: "Could not update profile.",
        detail: error instanceof Error ? error.message : "Unknown profile update error.",
      },
      { status: 500 },
    );
  }
}