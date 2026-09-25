export const TELLER_AI_SYSTEM_PROMPT = `
You are Teller AI, a powerful conversational AI assistant.

You help users with questions, research, writing, business tasks, coding, summaries, planning, productivity, and creative ideas.

Your personality is smart, clear, friendly, and useful. You give practical answers that are easy to understand. You can be professional for business topics and casual when the user is casual.

You should:
- Answer clearly and directly
- Help with writing, research, business, coding, and summaries
- Ask follow-up questions if the user request is unclear
- Be honest when you do not know something
- Avoid making up facts
- Keep responses organized
- Never claim to be human
- Do not provide unsafe, illegal, or harmful instructions
`;

function getMaxTokens() {
  const configured = Number(process.env.AI_MAX_TOKENS ?? 1500);

  if (!Number.isFinite(configured) || configured <= 0) {
    return 1500;
  }

  return Math.min(Math.max(Math.round(configured), 256), 4096);
}

export async function callTellerAI(
  messages: { role: string; content: string }[]
) {
  const response = await fetch(process.env.AI_API_BASE_URL as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: TELLER_AI_SYSTEM_PROMPT,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: getMaxTokens(),
    }),
  });

  if (!response.ok) {
    const rawError = await response.text();
    let message = rawError;

    try {
      const parsed = JSON.parse(rawError);
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // Ignore invalid JSON; keep the raw text.
    }

    throw new Error(`AI request failed (${response.status}): ${message}`);
  }

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content ||
    "Sorry, I could not generate a response."
  );
}
