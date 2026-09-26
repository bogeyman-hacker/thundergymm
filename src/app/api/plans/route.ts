import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q } from "@/lib/db";
import { handler, ok, fail, body, str, int, num } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireSession();
  const rows = await q(
    `SELECT id, name_ar, name_en, duration_days, sessions, price, color, active, sort_order
       FROM plans ORDER BY sort_order ASC, duration_days ASC`
  );
  return ok({ plans: rows });
});

export const POST = handler(async (req: NextRequest) => {
  await requireSession();
  const b = await body<any>(req);

  const nameAr = str(b.nameAr, 120);
  const nameEn = str(b.nameEn, 120);
  const days = int(b.durationDays, 0);
  if (!nameAr && !nameEn) return fail("A name is required", 422);
  if (days < 1) return fail("Duration must be at least 1 day", 422);

  // 0 = unlimited entries; anything else is a punch card (e.g. 15 in 30 days)
  const sessions = Math.max(0, int(b.sessions, 0));
  if (sessions > days) return fail("Sessions cannot exceed the plan length in days", 422);

  const r = await exec(
    `INSERT INTO plans (name_ar, name_en, duration_days, sessions, price, color, active, sort_order)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      nameAr || nameEn,
      nameEn || nameAr,
      days,
      sessions,
      num(b.price, 0),
      str(b.color, 20) || "#FFC531",
      b.active === false ? 0 : 1,
      int(b.sortOrder, 99),
    ]
  );
  return ok({ id: r.insertId }, 201);
});

export const PATCH = handler(async (req: NextRequest) => {
  await requireSession();
  const b = await body<any>(req);
  const id = int(b.id);
  if (!id) return fail("id is required", 422);

  const sets: string[] = [];
  const p: any[] = [];
  if (b.nameAr !== undefined) { sets.push("name_ar = ?"); p.push(str(b.nameAr, 120)); }
  if (b.nameEn !== undefined) { sets.push("name_en = ?"); p.push(str(b.nameEn, 120)); }
  if (b.durationDays !== undefined) { sets.push("duration_days = ?"); p.push(Math.max(1, int(b.durationDays, 1))); }
  if (b.sessions !== undefined) { sets.push("sessions = ?"); p.push(Math.max(0, int(b.sessions, 0))); }
  if (b.price !== undefined) { sets.push("price = ?"); p.push(num(b.price, 0)); }
  if (b.color !== undefined) { sets.push("color = ?"); p.push(str(b.color, 20)); }
  if (b.active !== undefined) { sets.push("active = ?"); p.push(b.active ? 1 : 0); }
  if (!sets.length) return fail("Nothing to update", 400);

  p.push(id);
  await exec(`UPDATE plans SET ${sets.join(", ")} WHERE id = ?`, p);
  return ok();
});

export const DELETE = handler(async (req: NextRequest) => {
  await requireSession();
  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return fail("id is required", 422);
  await exec(`DELETE FROM plans WHERE id = ?`, [id]);
  return ok();
});
