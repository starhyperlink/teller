import { NextResponse } from "next/server";
import { callTellerAI } from "@/lib/ai";
import { getAuth0User, getAuthenticatedUserId } from "@/lib/auth0-management";
import { incrementUserUsage } from "@/lib/postgres";
import { LOCAL_TEST_USER_ID } from "@/lib/local-test-auth";
import { COUNTRY_OPTIONS } from "@/lib/country-options";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    let country: string | undefined;
    if (userId && userId !== LOCAL_TEST_USER_ID) {
      try {
        const profile = await getAuth0User(userId);
        const countryCode = profile.user_metadata?.country;
        if (typeof countryCode === "string") {
          country = COUNTRY_OPTIONS.find((option) => option.code === countryCode)?.name;
        }
      } catch (error) {
        console.error("Could not load country context for chat:", error);
      }
    }

    const reply = await callTellerAI(messages, { country });

      // Ask the AI for a short title summarizing the conversation
      let title: string | null = null;
      try {
        const titlePrompt = `Please provide a concise title (no more than 6 words) that summarizes the conversation so far. Return ONLY the title on a single line.`;
        const titleResult = await callTellerAI([
          ...messages,
          { role: "user", content: titlePrompt },
        ], { maxTokens: 256 });

        // sanitize titleResult to a single line and reasonable length
        if (titleResult) {
          title = titleResult.split("\n")[0].slice(0, 100).trim();
        }
      } catch (e) {
        // ignore title errors
      }

      const usageCount = userId && userId !== LOCAL_TEST_USER_ID
        ? await incrementUserUsage(userId)
        : null;
      return NextResponse.json({ reply, title, usageCount });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
