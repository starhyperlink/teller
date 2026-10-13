const DEFAULT_RESOLUTION = "1K";
const DEFAULT_ASPECT_RATIO = "1:1";

const aspectRatios: Record<string, string> = {
  "1024x1024 ( 1:1 )": "1:1",
  "1152x896 ( 9:7 )": "5:4",
  "896x1152 ( 7:9 )": "4:5",
  "1152x864 ( 4:3 )": "4:3",
  "864x1152 ( 3:4 )": "3:4",
  "1248x832 ( 3:2 )": "3:2",
  "832x1248 ( 2:3 )": "2:3",
  "1280x720 ( 16:9 )": "16:9",
  "720x1280 ( 9:16 )": "9:16",
};

type ImageResponse = {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function getImageGenerationModel() {
  const model = process.env.IMAGE_GENERATION_MODEL?.trim();
  if (!model) {
    throw new Error("Image generation is not configured on the server.");
  }
  return model;
}

function parseChatCompletionResponse(value: unknown): ChatCompletionResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const response = value as Record<string, unknown>;
  const choices: NonNullable<ChatCompletionResponse["choices"]> = [];
  if (Array.isArray(response.choices)) {
    for (const choice of response.choices) {
      if (typeof choice !== "object" || choice === null || Array.isArray(choice)) continue;
      const message = (choice as Record<string, unknown>).message;
      if (typeof message !== "object" || message === null || Array.isArray(message)) continue;

      const content = (message as Record<string, unknown>).content;
      if (typeof content === "string") {
        choices.push({ message: { content } });
      } else if (Array.isArray(content)) {
        const textParts: Array<{ text?: string }> = [];
        for (const part of content) {
          if (typeof part !== "object" || part === null || Array.isArray(part)) continue;
          const text = (part as Record<string, unknown>).text;
          if (typeof text === "string") textParts.push({ text });
        }
        choices.push({ message: { content: textParts } });
      }
    }
  }

  let error: ChatCompletionResponse["error"];
  if (typeof response.error === "object" && response.error !== null && !Array.isArray(response.error)) {
    const providerError = response.error as Record<string, unknown>;
    error = typeof providerError.message === "string" ? { message: providerError.message } : undefined;
  }

  return { choices: Array.isArray(response.choices) ? choices : undefined, error };
}

function parseImageResponse(value: unknown): ImageResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const response = value as Record<string, unknown>;
  const data = Array.isArray(response.data)
    ? response.data.flatMap((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return [];
        }
        const image = item as Record<string, unknown>;
        return [{
          b64_json: typeof image.b64_json === "string" ? image.b64_json : undefined,
          media_type: typeof image.media_type === "string" ? image.media_type : undefined,
        }];
      })
    : undefined;

  let error: ImageResponse["error"];
  if (typeof response.error === "object" && response.error !== null && !Array.isArray(response.error)) {
    const providerError = response.error as Record<string, unknown>;
    error = typeof providerError.message === "string" ? { message: providerError.message } : undefined;
  }

  return { data, error };
}

function normalizePrompt(prompt: string) {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const normalized = trimmed.replace(
    /^(?:please\s+)?(?:make|create|generate|draw|design)\s+(?:me\s+)?(?:a\s+)?(?:pic|pict(?:ure)?|image|photo|snap)\s+(?:of|showing|with)\s+/i,
    "",
  );

  return normalized === trimmed ? trimmed : `Create an image of ${normalized}`;
}

export async function generateImageWithOpenRouter(
  prompt: string,
  resolution: string,
  referenceImage?: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Image generation is not configured on the server.");
  }
  const model = getImageGenerationModel();

  const selectedAspectRatio = resolution ? aspectRatios[resolution] : undefined;
  if (resolution && !selectedAspectRatio) {
    throw new Error("Choose a supported image size.");
  }

  const normalizedPrompt = normalizePrompt(prompt);
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: normalizedPrompt,
      resolution: DEFAULT_RESOLUTION,
      aspect_ratio: selectedAspectRatio || DEFAULT_ASPECT_RATIO,
      ...(referenceImage
        ? {
            input_references: [
              { type: "image_url", image_url: { url: referenceImage } },
            ],
          }
        : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error("OpenRouter returned an invalid image response.");
  }
  const result = parseImageResponse(responseBody);
  if (!response.ok) {
    throw new Error(result.error?.message || `OpenRouter image request failed (${response.status}).`);
  }

  const image = result.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenRouter returned no image data.");
  }

  const mediaType = image.media_type || "image/png";
  if (!/^image\/[a-zA-Z0-9.+-]+$/.test(mediaType)) {
    throw new Error("OpenRouter returned an unsupported image format.");
  }

  return {
    imageUrl: `data:${mediaType};base64,${image.b64_json}`,
    prompt: normalizedPrompt,
  };
}

export async function analyzeImageWithOpenRouter(
  prompt: string,
  imageDataUrl: string,
  country?: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Image analysis is not configured on the server.");
  }
  const model = getImageGenerationModel();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: [
            "You are Teller AI. Answer the user's request about the attached image accurately. Describe visible details and distinguish observations from inferences.",
            country
              ? `The authenticated user's country is ${country}. Use this context when relevant.`
              : "",
          ].filter(Boolean).join("\n\n"),
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error("OpenRouter returned an invalid image-analysis response.");
  }
  const result = parseChatCompletionResponse(responseBody);

  if (!response.ok) {
    throw new Error(result.error?.message || `OpenRouter image analysis failed (${response.status}).`);
  }

  const content = result.choices?.[0]?.message?.content;
  const answer = typeof content === "string"
    ? content.trim()
    : Array.isArray(content)
      ? content.map((part) => part.text || "").join("").trim()
      : "";
  if (!answer) {
    throw new Error("OpenRouter returned no image-analysis answer.");
  }

  return answer;
}
