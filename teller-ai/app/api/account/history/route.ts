import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth0-management";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { getUserChatData, saveUserChatHistory } from "@/lib/postgres";

export const runtime = "nodejs";

type StoredFile = {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  storagePath?: string;
};

function sanitizeHistory(value: unknown[]) {
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .slice(0, 20)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id.slice(0, 100) : crypto.randomUUID(),
      title: typeof item.title === "string" ? item.title.slice(0, 120) : "New chat",
      updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
      messages: Array.isArray(item.messages)
        ? item.messages
            .filter(
              (message): message is Record<string, unknown> =>
                Boolean(message) && typeof message === "object"
            )
            .slice(-30)
            .map((message) => {
              const file = message.file;
              const sanitizedFile =
                file && typeof file === "object"
                  ? (() => {
                      const fileRecord = file as Record<string, unknown>;
                      return {
                        name: typeof fileRecord.name === "string" ? fileRecord.name.slice(0, 200) : "attachment",
                        type: typeof fileRecord.type === "string" ? fileRecord.type.slice(0, 120) : "application/octet-stream",
                        size: typeof fileRecord.size === "number" ? fileRecord.size : 0,
                        ...(typeof fileRecord.dataUrl === "string" ? { dataUrl: fileRecord.dataUrl } : {}),
                        ...(typeof fileRecord.storagePath === "string" ? { storagePath: fileRecord.storagePath } : {}),
                      };
                    })()
                  : undefined;
              return {
                role: message.role === "user" ? "user" : "assistant",
                content: typeof message.content === "string" ? message.content.slice(0, 4000) : "",
                ...(sanitizedFile ? { file: sanitizedFile } : {}),
              };
            })
        : [],
    }));
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,([\s\S]+)$/);
  if (!match) return null;
  return { contentType: match[1] || "application/octet-stream", buffer: Buffer.from(match[2], "base64") };
}

async function storeMedia(history: ReturnType<typeof sanitizeHistory>, userId: string, bucket: ReturnType<typeof getFirebaseAdmin>["bucket"]) {
  return Promise.all(
    history.map(async (item) => ({
      ...item,
      messages: await Promise.all(
        item.messages.map(async (message) => {
          const file = message.file as StoredFile | undefined;
          if (!file?.dataUrl) return message;
          const parsed = parseDataUrl(file.dataUrl);
          if (!parsed) return message;
          const storagePath = `users/${encodeURIComponent(userId)}/chat-media/${item.id}/${crypto.randomUUID()}`;
          await bucket.file(storagePath).save(parsed.buffer, {
            metadata: { contentType: file.type || parsed.contentType },
          });
          return { ...message, file: { name: file.name, type: file.type, size: file.size, storagePath } };
        }),
      ),
    })),
  );
}

async function toClientHistory(history: ReturnType<typeof sanitizeHistory>, bucket: ReturnType<typeof getFirebaseAdmin>["bucket"]) {
  return Promise.all(
    history.map(async (item) => ({
      ...item,
      messages: await Promise.all(
        item.messages.map(async (message) => {
          const file = message.file as StoredFile | undefined;
          if (!file?.storagePath) return message;
          const [dataUrl] = await bucket.file(file.storagePath).getSignedUrl({
            action: "read",
            expires: Date.now() + 60 * 60 * 1000,
          });
          return {
            ...message,
            file: {
              name: file.name,
              type: file.type,
              size: file.size,
              storagePath: file.storagePath,
              dataUrl,
            },
          };
        }),
      ),
    })),
  );
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { bucket } = getFirebaseAdmin();
    const chatData = await getUserChatData(userId);
    const history = chatData
      ? await toClientHistory(sanitizeHistory(chatData.history), bucket)
      : [];
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Account history API error:", error);
    return NextResponse.json({ error: "Could not load chat history." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    if (!Array.isArray(body.history)) {
      return NextResponse.json({ error: "Invalid chat history." }, { status: 400 });
    }

    const { bucket } = getFirebaseAdmin();
    const history = await storeMedia(sanitizeHistory(body.history), userId, bucket);
    await saveUserChatHistory(userId, history);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account history API error:", error);
    return NextResponse.json({ error: "Could not save chat history." }, { status: 500 });
  }
}