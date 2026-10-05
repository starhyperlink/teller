type JsonRpcResponse = {
  id?: string | number;
  result?: {
    content?: Array<{
      type?: string;
      data?: string;
      mimeType?: string;
      text?: string;
      uri?: string;
    }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: { message?: string };
};

const DEFAULT_RESOLUTION = "1024x1024 ( 1:1 )";

function parseRpcResponse(body: string, id: number): JsonRpcResponse {
  const candidates = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (!candidates.length && body.trim()) candidates.push(body.trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as JsonRpcResponse;
      if (parsed.id === id) return parsed;
    } catch {
      continue;
    }
  }

  throw new Error("The image MCP server returned an invalid response.");
}

async function sendRpc(
  url: string,
  token: string | undefined,
  payload: Record<string, unknown>,
  sessionId?: string,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Image MCP request failed (${response.status}).`);
  }

  return { body, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

function normalizePrompt(prompt: string) {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const normalized = trimmed.replace(
    /^(?:please\s+)?(?:make|create|generate|draw|design)\s+(?:me\s+)?(?:a\s+)?(?:pic|pict(?:ure)?|image|photo|snap)\s+(?:of|showing|with)\s+/i,
    "",
  );

  return normalized === trimmed ? trimmed : `Create an image of ${normalized}`;
}

export async function generateImageWithMcp(prompt: string, resolution: string) {
  const url = process.env.HF_MCP_URL;
  const toolName = process.env.HF_MCP_IMAGE_TOOL;
  if (!url || !toolName) {
    throw new Error("Image generation is not configured on the server.");
  }

  const token = process.env.HF_TOKEN;
  const initialize = await sendRpc(url, token, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "teller-ai", version: "1.0.0" },
    },
  });
  const initialized = parseRpcResponse(initialize.body, 1);
  if (initialized.error) {
    throw new Error(initialized.error.message || "Could not initialize image generation.");
  }

  await sendRpc(
    url,
    token,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    initialize.sessionId,
  );

  const toolCall = await sendRpc(
    url,
    token,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: {
          prompt: normalizePrompt(prompt),
          resolution: resolution || DEFAULT_RESOLUTION,
          seed: 42,
          steps: 8,
          shift: 3,
          random_seed: true,
        },
      },
    },
    initialize.sessionId,
  );
  const result = parseRpcResponse(toolCall.body, 2);

  if (result.error) {
    throw new Error(result.error.message || "Image generation failed.");
  }
  if (result.result?.isError) {
    throw new Error("The image MCP tool could not generate this image.");
  }

  const image = result.result?.content?.find((item) => item.type === "image" && item.data);
  if (image?.data) {
    return {
      imageUrl: `data:${image.mimeType || "image/png"};base64,${image.data}`,
      prompt: normalizePrompt(prompt),
    };
  }

  const linkedImage = result.result?.content?.find(
    (item) => item.type === "resource_link" && item.uri?.startsWith("https://"),
  );
  if (linkedImage?.uri) {
    return { imageUrl: linkedImage.uri, prompt: normalizePrompt(prompt) };
  }

  throw new Error("The image MCP tool returned no displayable image.");
}