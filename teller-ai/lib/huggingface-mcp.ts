type McpContent = {
  type?: string;
  data?: string;
  mimeType?: string;
  text?: string;
};

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
};

type McpResponse = {
  result?: {
    tools?: McpTool[];
    content?: McpContent[];
    structuredContent?: Record<string, unknown>;
  };
  error?: { message?: string };
};

const MCP_URL = process.env.HF_MCP_URL || "https://huggingface.co/mcp";

function authHeaders() {
  const token = process.env.HF_TOKEN;
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function mcpRequest(method: string, params: Record<string, unknown>, id: number) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

  if (!response.ok) throw new Error(`Hugging Face MCP returned ${response.status}.`);

  const body = await response.text();
  const jsonLine = body.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
  const data = JSON.parse(jsonLine || body) as McpResponse;
  if (data.error) throw new Error(data.error.message || "Hugging Face MCP request failed.");
  return data;
}

function findImageTool(tools: McpTool[] | undefined) {
  const configuredName = process.env.HF_MCP_IMAGE_TOOL;
  if (configuredName) {
    const configuredTool = tools?.find((tool) => tool.name === configuredName);
    if (configuredTool) return configuredTool;
    throw new Error(`HF_MCP_IMAGE_TOOL "${configuredName}" was not returned by the MCP server.`);
  }

  return tools?.find((tool) => /image|text.to.image|generate/i.test(`${tool.name} ${tool.description || ""}`));
}

function getPromptField(tool: { inputSchema?: { properties?: Record<string, unknown> } }) {
  const fields = Object.keys(tool.inputSchema?.properties || {});
  return fields.find((field) => /prompt|text|input/i.test(field)) || fields[0];
}

function extractImage(content: McpContent[] | undefined, structuredContent?: Record<string, unknown>) {
  const image = content?.find((item) => item.type === "image" && item.data);
  if (image?.data) return `data:${image.mimeType || "image/png"};base64,${image.data}`;

  const candidates = [
    ...(content || []).map((item) => item.text),
    structuredContent?.image,
    structuredContent?.imageUrl,
    structuredContent?.url,
  ];
  const result = candidates.reduce<string | undefined>((found, value) => {
    if (found || typeof value !== "string") return found;
    if (value.startsWith("http") || value.startsWith("data:image/")) return value;
    return value.match(/https?:\/\/[^\s'"\]}]+/)?.[0];
  }, undefined);
  if (!result) throw new Error("The Hugging Face image tool did not return an image.");
  return result;
}

export async function generateImageWithHuggingFaceMcp(prompt: string) {
  await mcpRequest("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "teller-ai", version: "0.1.0" },
  }, 1);
  const toolsResponse = await mcpRequest("tools/list", {}, 2);
  const tool = findImageTool(toolsResponse.result?.tools);
  if (!tool) throw new Error("No Hugging Face image-generation tool is configured.");

  const promptField = getPromptField(tool);
  if (!promptField) throw new Error(`The MCP tool "${tool.name}" does not accept a prompt.`);

  const result = await mcpRequest("tools/call", {
    name: tool.name,
    arguments: {
      [promptField]: prompt,
      resolution: "1024x1024 ( 1:1 )",
      seed: 42,
      steps: 8,
      shift: 3,
      random_seed: true,
    },
  }, 3);
  return extractImage(result.result?.content, result.result?.structuredContent);
}