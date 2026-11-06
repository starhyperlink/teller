import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth0-auth";
import { plans, type PlanKey } from "@/lib/plans";
import {
  getCurrentUsageMonth,
  getUserAccountData,
  getUserChatData,
  getUserDailyImageUsage,
  updateUserAccountProfile,
} from "@/lib/postgres";
import { LOCAL_TEST_USER_ID } from "@/lib/local-test-auth";
import { COUNTRY_OPTIONS, PHONE_CODE_OPTIONS, splitInternationalPhone } from "@/lib/country-options";

export async function GET(request: Request) {
  const identity = await getAuthenticatedUser(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const userId = identity.sub;

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
      imageGenerationLimit: plans.free.imageGenerationLimit,
      imageGenerationCount: 0,
    });
  }

  try {
    const [account, chatData, imageGenerationCount] = await Promise.all([
      getUserAccountData(userId),
      getUserChatData(userId),
      getUserDailyImageUsage(userId),
    ]);
    const planKey = account.planKey in plans ? account.planKey as PlanKey : "free";
    const plan = plans[planKey];
    const usageMonth = getCurrentUsageMonth();
    const usageCount = chatData?.usageMonth === usageMonth ? chatData.usageCount : 0;
    const parsedPhone = splitInternationalPhone(account.phoneNumber);
    const phoneCountry = PHONE_CODE_OPTIONS.find(
      (option) => option.code === account.phoneCountry && option.dialCode === parsedPhone.phoneCountryCode,
    )?.code || PHONE_CODE_OPTIONS.find((option) => option.dialCode === parsedPhone.phoneCountryCode)?.code || "US";
    const name = [account.firstName, account.surname].filter(Boolean).join(" ") || identity.name || "";

    return NextResponse.json({
      name,
      firstName: account.firstName || identity.given_name || name.split(" ")[0] || "",
      surname: account.surname || identity.family_name || name.split(" ").slice(1).join(" ") || "",
      email: identity.email || "",
      country: account.country,
      phone: account.phoneNumber,
      phoneCountryCode: parsedPhone.phoneCountryCode,
      phoneCountry,
      phoneNumber: parsedPhone.phoneNumber,
      picture: identity.picture || "",
      plan: plan.name,
      billingInterval: plan.interval,
      usageLimit: plan.usageLimit,
      usageCount,
      imageGenerationLimit: plan.imageGenerationLimit,
      imageGenerationCount,
    });
  } catch (error) {
    console.error("Account API error:", error);
    return NextResponse.json({ error: "Could not load account." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const identity = await getAuthenticatedUser(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const userId = identity.sub;

  try {
    const body = await request.json();
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const surname = typeof body.surname === "string" ? body.surname.trim() : "";
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

    await updateUserAccountProfile(userId, {
      firstName,
      surname,
      country,
      phoneCountry,
      phoneNumber: phone,
    });
    const name = [firstName, surname].filter(Boolean).join(" ");
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