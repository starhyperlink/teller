import { NextResponse } from "next/server";
import { getAuth0User, getAuthenticatedUserId, updateAuth0Profile } from "@/lib/auth0-management";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { plans, type PlanKey } from "@/lib/plans";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const user = await getAuth0User(userId);
    const metadata = user.app_metadata || {};
    const metadataPlan = metadata.plan as PlanKey;
    const planKey = metadataPlan in plans ? metadataPlan : "free";
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

export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const surname = typeof body.surname === "string" ? body.surname.trim() : "";
    if (!firstName || !surname || firstName.length > 80 || surname.length > 80) {
      return NextResponse.json({ error: "Enter a valid first name and surname." }, { status: 400 });
    }

    await updateAuth0Profile(userId, {
      given_name: firstName,
      family_name: surname,
      name: `${firstName} ${surname}`,
    });
    return NextResponse.json({ ok: true, name: `${firstName} ${surname}` });
  } catch (error) {
    console.error("Account profile update error:", error);
    return NextResponse.json({ error: "Could not update account profile." }, { status: 500 });
  }
}