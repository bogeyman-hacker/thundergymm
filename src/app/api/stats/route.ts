import { requireSession } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { handler, ok } from "@/lib/http";
import { sweepExpired } from "@/lib/notify";
import { fetchMembers } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireSession();
  await sweepExpired();

  const members = await fetchMembers(`ORDER BY m.created_at DESC LIMIT 2000`);

  const counts = { active: 0, expiring: 0, expired: 0, none: 0, total: members.length };
  for (const m of members) {
    if (m.state === "active") counts.active++;
    else if (m.state === "expiring") counts.expiring++;
    else if (m.state === "expired") counts.expired++;
    else counts.none++;
  }

  const todayRow = await q1<{ c: number }>(
    `SELECT COUNT(*) AS c FROM checkins WHERE result='granted' AND DATE(scanned_at)=CURDATE()`
  );

  const revRow = await q1<{ s: string | null }>(
    `SELECT SUM(amount) AS s FROM payments
      WHERE YEAR(paid_at)=YEAR(CURDATE()) AND MONTH(paid_at)=MONTH(CURDATE())`
  );

  // last 7 days of check-ins
  const week = await q<{ d: string; c: number }>(
    `SELECT DATE(scanned_at) AS d, COUNT(*) AS c
       FROM checkins
      WHERE result='granted' AND scanned_at >= (CURDATE() - INTERVAL 6 DAY)
      GROUP BY DATE(scanned_at) ORDER BY d ASC`
  );

  const series: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const hit = week.find((w) => String(w.d).slice(0, 10) === iso);
    series.push({ date: iso, count: Number(hit?.c ?? 0) });
  }

  const recent = await q(
    `SELECT c.id, c.scanned_at, c.result, c.days_left,
            m.id AS member_id, m.full_name, m.serial, m.gender
       FROM checkins c JOIN members m ON m.id = c.member_id
      ORDER BY c.scanned_at DESC LIMIT 8`
  );

  const attention = members
    .filter((m) => m.state === "expiring" || m.state === "expired")
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);

  return ok({
    counts,
    todayCheckins: Number(todayRow?.c ?? 0),
    revenue: Number(revRow?.s ?? 0),
    series,
    recent,
    attention,
  });
});
