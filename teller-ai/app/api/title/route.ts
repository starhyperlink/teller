import { NextResponse } from "next/server";
import { callTellerAI } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required." }, { status: 400 });
    }

    const titlePrompt = `Please provide a concise title (no more than 6 words) that summarizes the conversation so far. Return ONLY the title on a single line.`;

    const titleResult = await callTellerAI(
      [...messages, { role: "user", content: titlePrompt }],
      { maxTokens: 256 },
    );

    const title = titleResult ? titleResult.split("\n")[0].slice(0, 100).trim() : null;

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title API error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
