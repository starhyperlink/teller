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
    `).then(() => undefined);
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