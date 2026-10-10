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
    globalForPostgres.tellerPostgresSchema = getPool().query(`
      CREATE TABLE IF NOT EXISTS teller_user_chat_data (
        user_id TEXT PRIMARY KEY,
        usage_month TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
        history JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS teller_chat_media (
          id UUID PRIMARY KEY,
          user_id TEXT NOT NULL,
          history_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          content_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          media_data BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await getPool().query(`
        CREATE INDEX IF NOT EXISTS teller_chat_media_user_history_idx
        ON teller_chat_media (user_id, history_id)
      `);
    });
  }
  await globalForPostgres.tellerPostgresSchema;
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

export async function saveUserChatMedia(
  userId: string,
  historyId: string,
  fileName: string,
  contentType: string,
  mediaData: Buffer,
) {
  await ensureSchema();
  const mediaId = crypto.randomUUID();
  await getPool().query(
    `
      INSERT INTO teller_chat_media (id, user_id, history_id, file_name, content_type, file_size, media_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [mediaId, userId, historyId, fileName, contentType, mediaData.length, mediaData],
  );
  return mediaId;
}

export async function getUserChatMedia(userId: string, mediaId: string) {
  await ensureSchema();
  const result = await getPool().query<{
    file_name: string;
    content_type: string;
    file_size: number;
    media_data: Buffer;
  }>(
    "SELECT file_name, content_type, file_size, media_data FROM teller_chat_media WHERE user_id = $1 AND id = $2",
    [userId, mediaId],
  );
  const row = result.rows[0];
  return row
    ? {
        fileName: row.file_name,
        contentType: row.content_type,
        fileSize: row.file_size,
        mediaData: row.media_data,
      }
    : null;
}

export async function getUserGeneratedImages(userId: string, limit: number, offset: number) {
  await ensureSchema();
  const result = await getPool().query<{
    id: string;
    history_id: string;
    created_at: Date;
  }>(
    `
      SELECT id, history_id, created_at
      FROM teller_chat_media
      WHERE user_id = $1 AND file_name = 'generated-image' AND content_type LIKE 'image/%'
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset],
  );

  return result.rows.map((row) => ({
    id: row.id,
    historyId: row.history_id,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getUserGeneratedImage(userId: string, mediaId: string) {
  await ensureSchema();
  const result = await getPool().query<{
    content_type: string;
    media_data: Buffer;
  }>(
    `
      SELECT content_type, media_data
      FROM teller_chat_media
      WHERE user_id = $1 AND id = $2 AND file_name = 'generated-image'
        AND content_type LIKE 'image/%'
    `,
    [userId, mediaId],
  );
  const row = result.rows[0];
  return row
    ? { contentType: row.content_type, mediaData: row.media_data }
    : null;
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