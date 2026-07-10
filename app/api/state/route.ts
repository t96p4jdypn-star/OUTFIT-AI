import { env } from "cloudflare:workers";

const bindings = env as unknown as { DB: D1Database };

const createSql = `CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

async function ensureTable() {
  await bindings.DB.prepare(createSql).run();
}

export async function GET() {
  await ensureTable();
  const row = await bindings.DB.prepare("SELECT payload FROM app_state WHERE id = 1").first<{ payload: string }>();
  return Response.json(row ? JSON.parse(row.payload) : null);
}

export async function PUT(request: Request) {
  await ensureTable();
  const payload = await request.json();
  await bindings.DB.prepare(
    "INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
  ).bind(JSON.stringify(payload), new Date().toISOString()).run();
  return Response.json({ ok: true });
}
