import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { handler, ok, int, str } from "@/lib/http";
import { sweepExpired } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  await requireSession();
  await sweepExpired();

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(300, Math.max(1, int(sp.get("limit"), 60)));
  const only = str(sp.get("only"), 20); // granted | denied

  let cond = "";
  if (only === "granted") cond = `WHERE c.result = 'granted'`;
  else if (only === "denied") cond = `WHERE c.result <> 'granted'`;

  const rows = await q(
    `SELECT c.id, c.scanned_at, c.result, c.days_left, c.source,
            m.id AS member_id, m.full_name, m.serial, m.gender, m.phone
       FROM checkins c
       JOIN members m ON m.id = c.member_id
       ${cond}
      ORDER BY c.scanned_at DESC
      LIMIT ${limit}`
  );

  const todayRow = await q1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM checkins WHERE result='granted' AND DATE(scanned_at) = CURDATE()`
  );

  return ok({ checkins: rows, todayCount: Number(todayRow?.c ?? 0) });
});
