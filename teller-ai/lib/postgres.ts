import { Pool } from "pg";

type UserChatData = {
  history: unknown[];
  usageMonth: string;
  usageCount: number;
};

const globalForPostgres = globalThis as typeof globalThis & {
  tellerPostgresPool?: Pool;
  tellerPostgresSchema?: Promise<void>;
};

export type GeneratedImageRecord = {
  imageData: Buffer | null;
  mimeType: string;
  sourceUrl: string | null;
};

function getPool() {
  if (!globalForPostgres.tellerPostgresPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not configured.");
    globalForPostgres.tellerPostgresPool = new Pool({ connectionString, max: 5 });
  }
  return globalForPostgres.tellerPostgresPool;
}

async function ensureSchema() {
  if (!globalForPostgres.tellerPostgresSchema) {
    globalForPostgres.tellerPostgresSchema = (async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS teller_user_chat_data (
          user_id TEXT PRIMARY KEY,
          usage_month TEXT NOT NULL,
          usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
          history JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS teller_generated_images (
          id TEXT PRIMARY KEY,
          prompt TEXT NOT NULL,
          image_data BYTEA,
          mime_type TEXT NOT NULL,
          source_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (image_data IS NOT NULL OR source_url IS NOT NULL)
        )
      `);
    })();
  }
  await globalForPostgres.tellerPostgresSchema;
}

export async function saveGeneratedImage(prompt: string, imageUrl: string) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const dataUrlMatch = imageUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  const imageData = dataUrlMatch ? Buffer.from(dataUrlMatch[2], "base64") : null;
  const mimeType = dataUrlMatch?.[1] || "image/png";
  const sourceUrl = imageData ? null : imageUrl;

  if (!imageData && (!sourceUrl || !sourceUrl.startsWith("https://"))) {
    throw new Error("The image provider returned an unsupported image URL.");
  }

  await getPool().query(
    `INSERT INTO teller_generated_images (id, prompt, image_data, mime_type, source_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, prompt, imageData, mimeType, sourceUrl],
  );
  return id;
}

export async function getGeneratedImage(id: string): Promise<GeneratedImageRecord | null> {
  await ensureSchema();
  const result = await getPool().query<{
    image_data: Buffer | null;
    mime_type: string;
    source_url: string | null;
  }>(
    "SELECT image_data, mime_type, source_url FROM teller_generated_images WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    imageData: row.image_data,
    mimeType: row.mime_type,
    sourceUrl: row.source_url,
  };
}

function currentUsageMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getUserChatData(userId: string): Promise<UserChatData | null> {
  await ensureSchema();
  const result = await getPool().query<{
    history: unknown[];
    usage_month: string;
    usage_count: number;
  }>(
    "SELECT history, usage_month, usage_count FROM teller_user_chat_data WHERE user_id = $1",
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    history: Array.isArray(row.history) ? row.history : [],
    usageMonth: row.usage_month,
    usageCount: row.usage_count,
  };
}

export async function saveUserChatHistory(userId: string, history: unknown[]) {
  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO teller_user_chat_data (user_id, usage_month, history, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET history = EXCLUDED.history, updated_at = NOW()
    `,
    [userId, currentUsageMonth(), JSON.stringify(history)],
  );
}

export async function saveUserUsage(userId: string, usageCount: number, usageMonth = currentUsageMonth()) {
  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO teller_user_chat_data (user_id, usage_month, usage_count, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        usage_month = EXCLUDED.usage_month,
        usage_count = EXCLUDED.usage_count,
        updated_at = NOW()
    `,
    [userId, usageMonth, usageCount],
  );
}

export async function incrementUserUsage(userId: string) {
  await ensureSchema();
  const usageMonth = currentUsageMonth();
  const result = await getPool().query<{ usage_count: number }>(
    `
      INSERT INTO teller_user_chat_data (user_id, usage_month, usage_count, updated_at)
      VALUES ($1, $2, 1, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        usage_month = EXCLUDED.usage_month,
        usage_count = CASE
          WHEN teller_user_chat_data.usage_month = EXCLUDED.usage_month
            THEN teller_user_chat_data.usage_count + 1
          ELSE 1
        END,
        updated_at = NOW()
      RETURNING usage_count
    `,
    [userId, usageMonth],
  );
  return result.rows[0].usage_count;
}

export function getCurrentUsageMonth() {
  return currentUsageMonth();
}