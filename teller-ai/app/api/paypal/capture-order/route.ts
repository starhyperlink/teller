import { NextResponse } from "next/server";

const paypalBaseUrl =
  process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("PayPal authentication failed.");
  }

  const result = await response.json();
  return result.access_token as string;
}

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!orderId || !appUrl) {
    return NextResponse.redirect(`${appUrl || ""}/pricing?paypal=canceled`);
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(
      `${paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("PayPal payment capture failed.");
    }

    return NextResponse.redirect(`${appUrl}/chat?paypal=success`);
  } catch (error) {
    console.error("PayPal capture error:", error);
    return NextResponse.redirect(`${appUrl}/pricing?paypal=error`);
  }
}