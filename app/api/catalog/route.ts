import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { MAX_CATALOG_BYTES, validatePayload } from "../../../lib/catalog-validation";

export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
type Row = { records_json: string; revision: number; updated_at: string };

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

async function current(userId: string) {
  const row = await env.DB!.prepare("SELECT records_json, revision, updated_at FROM catalogs WHERE user_id = ?").bind(userId).first<Row>();
  return row ? { records: JSON.parse(row.records_json), revision: row.revision, updatedAt: row.updated_at } : { records: [], revision: 0, updatedAt: null };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "Sign in to save and synchronize your catalog." }, 401);
  if (!env.DB) return reply({ error: "Online saving is temporarily unavailable. Your device copy is still available." }, 503);
  try { return reply(await current(user.userId)); }
  catch { return reply({ error: "The saved catalog could not be loaded. Your device copy is still available." }, 503); }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "Sign in to save and synchronize your catalog." }, 401);
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Cross-site changes are not allowed." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Send a JSON catalog." }, 415);
  if (!env.DB) return reply({ error: "Online saving is temporarily unavailable. Export a backup to preserve your changes." }, 503);
  const advertisedLength = Number(request.headers.get("content-length") || 0);
  if (advertisedLength > MAX_CATALOG_BYTES) return reply({ error: "This catalog exceeds the 2 MB limit." }, 413);
  let records: Record<string, unknown>[];
  let baseRevision: number;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_CATALOG_BYTES) return reply({ error: "This catalog exceeds the 2 MB limit." }, 413);
    ({ records, baseRevision } = validatePayload(JSON.parse(body)));
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Invalid catalog." }, 400); }
  try {
    const serialized = JSON.stringify(records);
    const updatedAt = new Date().toISOString();
    const result = baseRevision === 0
      ? await env.DB.prepare("INSERT INTO catalogs (user_id, records_json, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision").bind(user.userId, serialized, updatedAt).first<{ revision: number }>()
      : await env.DB.prepare("UPDATE catalogs SET records_json = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? RETURNING revision").bind(serialized, updatedAt, user.userId, baseRevision).first<{ revision: number }>();
    if (!result) return reply({ error: "This catalog changed on another device. Merge the latest version before saving.", ...(await current(user.userId)) }, 409);
    return reply({ revision: result.revision, updatedAt });
  } catch { return reply({ error: "Online saving did not complete. Your changes remain on this device; export a backup before closing." }, 503); }
}
