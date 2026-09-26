import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q, q1 } from "@/lib/db";
import { handler, ok, body, int } from "@/lib/http";
import { sweepLowAttendance } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  await requireSession();
  const limit = Math.min(80, Math.max(1, int(req.nextUrl.searchParams.get("limit"), 25)));
  await sweepLowAttendance();

  const rows = await q(
    `SELECT n.id, n.type, n.member_id, n.title_ar, n.title_en,
            n.body_ar, n.body_en, n.severity, n.is_read, n.created_at,
            m.phone AS member_phone, m.full_name AS member_name
       FROM notifications n
       LEFT JOIN members m ON m.id = n.member_id
      ORDER BY n.created_at DESC, n.id DESC LIMIT ${limit}`
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
