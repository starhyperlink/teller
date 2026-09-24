import { NextResponse } from "next/server";
import { callTellerAI } from "@/lib/ai";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { generateImageWithHuggingFaceMcp } from "@/lib/huggingface-mcp";
import { incrementUserUsage } from "@/lib/postgres";

export const runtime = "nodejs";

function isImageRequest(content: string) {
  return /\b(generate|create|make|draw|render|design)\b[\s\S]*\b(image|picture|photo|illustration|artwork|logo)\b|\b(image|picture|photo|illustration|artwork|logo)\s+of\b/i.test(content);
}

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

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message?.role === "user" && typeof message.content === "string");
    const imageRequested = latestUserMessage && isImageRequest(latestUserMessage.content);
    const imageUrl = imageRequested
      ? await generateImageWithHuggingFaceMcp(latestUserMessage.content)
      : null;
    const reply = imageUrl
      ? "Here is the image I generated from your prompt."
      : await callTellerAI(messages);

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

      const usageCount = userId
        ? await incrementUserUsage(userId)
        : null;
      return NextResponse.json({ reply, imageUrl, title, usageCount });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
