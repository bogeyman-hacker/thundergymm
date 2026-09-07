import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q, q1 } from "@/lib/db";
import { handler, ok, body, int } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  await requireSession();
  const limit = Math.min(80, Math.max(1, int(req.nextUrl.searchParams.get("limit"), 25)));

  const rows = await q(
    `SELECT id, type, member_id, title_ar, title_en, body_ar, body_en, severity, is_read, created_at
       FROM notifications ORDER BY created_at DESC, id DESC LIMIT ${limit}`
  );
  const unread = await q1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0`
  );

  return ok({ notifications: rows, unread: Number(unread?.c ?? 0) });
});

/** POST { id } marks one read, POST { all: true } marks everything read. */
export const POST = handler(async (req: NextRequest) => {
  await requireSession();
  const b = await body<{ id?: number; all?: boolean }>(req);

  if (b.all) await exec(`UPDATE notifications SET is_read = 1 WHERE is_read = 0`);
  else if (b.id) await exec(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [int(b.id)]);

  const unread = await q1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0`
  );
  return ok({ unread: Number(unread?.c ?? 0) });
});
