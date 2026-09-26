import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q1 } from "@/lib/db";
import { handler, ok, fail, body, str, int, num } from "@/lib/http";
import { fetchMembers } from "@/lib/queries";
import { addDays, dayOf, toISODate, today } from "@/lib/subs";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/members/:id/renew
 * Starts the new period the day after the current one ends (if still running),
 * otherwise from today — or from an explicit startDate.
 */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireSession();
  const id = int((await ctx.params).id);
  const b = await body<any>(req);

  const member = await q1<{ id: number; full_name: string; serial: string }>(
    `SELECT id, full_name, serial FROM members WHERE id = ?`,
    [id]
  );
  if (!member) return fail("Member not found", 404);

  const planId = b.planId ? int(b.planId) : null;
  let durationDays = int(b.durationDays, 0);
  let planLabel = str(b.planLabel, 120);
  let price = num(b.price, 0);

  let sessions = b.sessions === undefined ? -1 : Math.max(0, int(b.sessions, 0));

  if (planId) {
    const p = await q1<{
      name_ar: string; name_en: string; duration_days: number; sessions: number; price: string;
    }>(
      `SELECT name_ar, name_en, duration_days, sessions, price FROM plans WHERE id = ?`,
      [planId]
    );
    if (!p) return fail("Plan not found", 422);
    durationDays = durationDays || p.duration_days;
    planLabel = planLabel || `${p.name_ar} / ${p.name_en}`;
    if (b.price === undefined || b.price === "") price = Number(p.price);
    if (sessions < 0) sessions = Number(p.sessions ?? 0);
  }
  if (sessions < 0) sessions = 0;

  if (durationDays < 1) return fail("Duration must be at least 1 day", 422);
  if (!planLabel) planLabel = `${durationDays} days`;
  const paid = num(b.paid, price);
  if (price < 0 || paid < 0 || paid > price) return fail("Paid must be between zero and price", 422);

  // work out the start date
  let start = today();
  if (b.startDate) {
    start = dayOf(str(b.startDate, 10));
  } else {
    const cur = await q1<{ end_date: string }>(
      `SELECT end_date FROM subscriptions
        WHERE member_id = ? AND status = 'active' AND end_date >= CURDATE()
        ORDER BY end_date DESC LIMIT 1`,
      [id]
    );
    if (cur) start = addDays(dayOf(cur.end_date), 1);
  }

  const end = addDays(start, durationDays - 1);

  const r = await exec(
    `INSERT INTO subscriptions
       (member_id, plan_id, plan_label, duration_days, sessions_total, sessions_used,
        start_date, end_date, price, paid, status)
     VALUES (?,?,?,?,?,0,?,?,?,?, 'active')`,
    [id, planId, planLabel, durationDays, sessions, toISODate(start), toISODate(end), price, paid]
  );

  // an active renewal supersedes an expired record's reminders
  await exec(
    `UPDATE subscriptions SET status = 'expired'
      WHERE member_id = ? AND id <> ? AND end_date < CURDATE() AND status = 'active'`,
    [id, r.insertId]
  );

  if (paid > 0) {
    await exec(`INSERT INTO payments (subscription_id, member_id, kind, amount)
                VALUES (?,?,'renewal',?)`, [r.insertId, id, paid]);
  }

  await notify({
    type: "renewed",
    memberId: id,
    titleAr: "تجديد اشتراك",
    titleEn: "Subscription renewed",
    bodyAr: `${member.full_name} — ${planLabel} حتى ${toISODate(end)}`,
    bodyEn: `${member.full_name} — ${planLabel} until ${toISODate(end)}`,
    severity: "success",
  });

  const [updated] = await fetchMembers(`WHERE m.id = ?`, [id]);
  return ok({ member: updated, subscriptionId: r.insertId }, 201);
});
