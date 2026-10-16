import { getNvidiaAIConfig } from "@/lib/nvidia-ai";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_ROUTER_MODEL = "openrouter/auto";

type ChatProvider = {
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
};

export function hasChatAIProvider() {
  return Boolean(
    process.env.NVIDIA_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.OPENROUTER_API_KEY,
  );
}

function getChatProviders(): ChatProvider[] {
  const providers: ChatProvider[] = [];

  if (process.env.NVIDIA_API_KEY || process.env.AI_API_KEY) {
    const config = getNvidiaAIConfig();
    providers.push({ name: "NVIDIA", ...config });
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    providers.push({
      name: "OpenRouter",
      apiKey: openRouterApiKey,
      apiBaseUrl: OPENROUTER_CHAT_COMPLETIONS_URL,
      model: OPENROUTER_ROUTER_MODEL,
    });
  }

  return providers;
}

export async function callRoutedChatCompletion<T = unknown>(
  requestBody: Record<string, unknown>,
): Promise<T> {
  const providers = getChatProviders();
  if (!providers.length) {
    throw new Error("No chat AI provider is configured. Set NVIDIA_API_KEY or OPENROUTER_API_KEY.");
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const response = await fetch(provider.apiBaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({ ...requestBody, model: provider.model }),
        cache: "no-store",
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 400);
        throw new Error(
          `${provider.name} chat request failed (${response.status})${detail ? `: ${detail}` : "."}`,
        );
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured chat AI providers failed.");
}