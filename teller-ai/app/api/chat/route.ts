import { NextResponse } from "next/server";
import { callTellerAI } from "@/lib/ai";
import { getAuthenticatedUserId, isLocalTestAccountRequest } from "@/lib/auth0-management";
import { incrementUserUsage } from "@/lib/postgres";

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

    const reply = await callTellerAI(messages);

      // Ask the AI for a short title summarizing the conversation
      let title: string | null = null;
      try {
        const titlePrompt = `Please provide a concise title (no more than 6 words) that summarizes the conversation so far. Return ONLY the title on a single line.`;
        const titleResult = await callTellerAI([
          ...messages,
          { role: "user", content: titlePrompt },
        ]);

        // sanitize titleResult to a single line and reasonable length
        if (titleResult) {
          title = titleResult.split("\n")[0].slice(0, 100).trim();
        }
      } catch (e) {
        // ignore title errors
      }

      const usageCount = userId && !isLocalTestAccountRequest(req)
        ? await incrementUserUsage(userId)
        : null;
      return NextResponse.json({ reply, title, usageCount });
  } catch (error) {
    console.error("Chat API error:", error);

    const message = error instanceof Error ? error.message : "Something went wrong.";

    if (/credit|max_tokens|402/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "The AI provider has exhausted its credits for this request. Please add credits or lower the request size.",
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
