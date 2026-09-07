import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q } from "@/lib/db";
import { handler, ok, fail, body, str, int } from "@/lib/http";
import { fetchMembers } from "@/lib/queries";
import { normalizePhone } from "@/lib/wa";
import { sweepExpired } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  await requireSession();
  await sweepExpired();
  const id = int((await ctx.params).id);

  const [member] = await fetchMembers(`WHERE m.id = ?`, [id]);
  if (!member) return fail("Member not found", 404);

  const subs = await q(
    `SELECT id, plan_label, duration_days, start_date, end_date, price, paid, status, created_at
       FROM subscriptions WHERE member_id = ? ORDER BY start_date DESC, id DESC`,
    [id]
  );
  const visits = await q(
    `SELECT id, scanned_at, result, days_left FROM checkins
      WHERE member_id = ? ORDER BY scanned_at DESC LIMIT 50`,
    [id]
  );

  return ok({ member, subscriptions: subs, visits });
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireSession();
  const id = int((await ctx.params).id);
  const b = await body<any>(req);

  const sets: string[] = [];
  const params: any[] = [];

  if (b.name !== undefined) { sets.push("full_name = ?"); params.push(str(b.name, 160)); }
  if (b.phone !== undefined) { sets.push("phone = ?"); params.push(normalizePhone(str(b.phone, 30))); }
  if (b.gender !== undefined) { sets.push("gender = ?"); params.push(b.gender === "female" ? "female" : "male"); }
  if (b.birthDate !== undefined) { sets.push("birth_date = ?"); params.push(str(b.birthDate, 10) || null); }
  if (b.notes !== undefined) { sets.push("notes = ?"); params.push(str(b.notes, 1000) || null); }
  if (b.status !== undefined) {
    const s = ["active", "frozen", "blocked"].includes(b.status) ? b.status : "active";
    sets.push("status = ?"); params.push(s);
  }

  if (!sets.length) return fail("Nothing to update", 400);
  params.push(id);
  await exec(`UPDATE members SET ${sets.join(", ")} WHERE id = ?`, params);

  const [member] = await fetchMembers(`WHERE m.id = ?`, [id]);
  return ok({ member });
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  await requireSession();
  const id = int((await ctx.params).id);
  const r = await exec(`DELETE FROM members WHERE id = ?`, [id]);
  if (!r.affectedRows) return fail("Member not found", 404);
  return ok({ deleted: id });
});
