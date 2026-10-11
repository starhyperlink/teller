import { notFound } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import { isAgentId } from "@/lib/agents";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent } = await params;
  if (!isAgentId(agent) || agent === "teller") notFound();

  return <ChatWindow agent={agent} />;
}
