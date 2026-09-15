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

export type TellerAccountContext = {
  name: string;
};

export async function callTellerAI(
  messages: { role: string; content: string }[],
  accountContext?: TellerAccountContext
) {
  const accountPrompt = accountContext
    ? `\n\nThe user's name is ${accountContext.name}. Address the user by name when appropriate.`
    : "";
  const response = await fetch(process.env.AI_API_BASE_URL as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages: [
        {
          role: "system",
          content: `${TELLER_AI_SYSTEM_PROMPT}${accountPrompt}`,
        },
        ...messages,
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content ||
    "Sorry, I could not generate a response."
  );
}
