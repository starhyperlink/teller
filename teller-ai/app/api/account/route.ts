import { NextResponse } from "next/server";
import {
  getAuth0User,
  getAuthenticatedUserId,
  updateAuth0Profile,
} from "@/lib/auth0-management";
import { plans, type PlanKey } from "@/lib/plans";
import { getCurrentUsageMonth, getUserChatData } from "@/lib/postgres";
import { LOCAL_TEST_USER_ID } from "@/lib/local-test-auth";
import { COUNTRY_OPTIONS, PHONE_CODE_OPTIONS, splitInternationalPhone } from "@/lib/country-options";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (userId === LOCAL_TEST_USER_ID && process.env.NODE_ENV === "development") {
    return NextResponse.json({
      name: "Local Test Account",
      firstName: "Local",
      surname: "Test Account",
      email: "local-test@example.test",
      country: "",
      phone: "",
      picture: "",
      plan: plans.free.name,
      billingInterval: plans.free.interval,
      usageLimit: plans.free.usageLimit,
      usageCount: 0,
    });
  }

  try {
    const user = await getAuth0User(userId);
    const metadata = user.app_metadata || {};
    const metadataPlan = metadata.plan as PlanKey;
    const planKey = metadataPlan in plans ? metadataPlan : "free";
    const plan = plans[planKey];
    const usageMonth = getCurrentUsageMonth();
    const chatData = await getUserChatData(userId);
    const usageCount = chatData?.usageMonth === usageMonth ? chatData.usageCount : 0;
    const parsedPhone = splitInternationalPhone(user.phone_number || "");
    const storedPhoneCountry = typeof user.user_metadata?.phoneCountry === "string"
      ? user.user_metadata.phoneCountry
      : "";
    const phoneCountry = PHONE_CODE_OPTIONS.find(
      (option) => option.code === storedPhoneCountry && option.dialCode === parsedPhone.phoneCountryCode,
    )?.code || PHONE_CODE_OPTIONS.find((option) => option.dialCode === parsedPhone.phoneCountryCode)?.code || "US";

    return NextResponse.json({
      name: user.name || "",
      firstName: user.given_name || user.name?.split(" ")[0] || "",
      surname: user.family_name || user.name?.split(" ").slice(1).join(" ") || "",
      email: user.email || "",
      country: typeof user.user_metadata?.country === "string" ? user.user_metadata.country : "",
      phone: user.phone_number || "",
      phoneCountryCode: parsedPhone.phoneCountryCode,
      phoneCountry,
      phoneNumber: parsedPhone.phoneNumber,
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
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const surname = typeof body.surname === "string" ? body.surname.trim() : "";
    const name = [firstName, surname].filter(Boolean).join(" ");
    const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
    const phoneCountry = typeof body.phoneCountry === "string" ? body.phoneCountry.trim().toUpperCase() : "US";
    const selectedPhoneCountry = PHONE_CODE_OPTIONS.find((option) => option.code === phoneCountry);
    const phoneCountryCode = selectedPhoneCountry?.dialCode || "";
    const rawPhoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const phoneDigits = rawPhoneNumber.replace(/[\s().-]/g, "");
    const phone = phoneDigits ? `${phoneCountryCode}${phoneDigits}` : "";

    if (!firstName || !surname || firstName.length > 60 || surname.length > 60) {
      return NextResponse.json({ error: "Enter a valid name and surname (up to 60 characters each)." }, { status: 400 });
    }
    if (phone.length > 40) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (country && !COUNTRY_OPTIONS.some((option) => option.code === country)) {
      return NextResponse.json({ error: "Select a supported country." }, { status: 400 });
    }
    if (!selectedPhoneCountry) {
      return NextResponse.json({ error: "Select a supported phone country code." }, { status: 400 });
    }
    if (rawPhoneNumber && (!/^\d+$/.test(phoneDigits) || phoneDigits.length < 4 || phoneDigits.length > 15)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    if (userId === LOCAL_TEST_USER_ID && process.env.NODE_ENV === "development") {
      return NextResponse.json({ name, firstName, surname, country, phone, phoneCountryCode, phoneCountry, phoneNumber: phoneDigits });
    }

    const existingUser = await getAuth0User(userId);
    await updateAuth0Profile(
      userId,
      {
        name,
        given_name: firstName,
        family_name: surname,
        user_metadata: { ...existingUser.user_metadata, country, phoneCountry },
        ...(phone ? { phone_number: phone } : {}),
      },
    );
    return NextResponse.json({ name, firstName, surname, country, phone, phoneCountryCode, phoneCountry, phoneNumber: phoneDigits });
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