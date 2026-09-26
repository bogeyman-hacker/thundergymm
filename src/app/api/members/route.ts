import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { exec, q1 } from "@/lib/db";
import { handler, ok, fail, body, str, int, num } from "@/lib/http";
import { fetchMembers, nextSerial } from "@/lib/queries";
import { addDays, dayOf, toISODate, today } from "@/lib/subs";
import { normalizePhone } from "@/lib/wa";
import { notify, sweepExpired } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/members?search=&filter=&limit= */
export const GET = handler(async (req: NextRequest) => {
  await requireSession();
  await sweepExpired();

  const sp = req.nextUrl.searchParams;
  const search = str(sp.get("search"), 80);
  const filter = str(sp.get("filter"), 20) || "all";
  const limit = Math.min(500, Math.max(1, int(sp.get("limit"), 300)));

  let where = "";
  const params: any[] = [];
  if (search) {
    where = `WHERE (m.full_name LIKE ? OR m.phone LIKE ? OR m.serial LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  where += ` ORDER BY m.created_at DESC LIMIT ${limit}`;

  let list = await fetchMembers(where, params);

  if (filter !== "all") {
    const map: Record<string, string[]> = {
      active: ["active"],
      expiring: ["expiring"],
      expired: ["expired"],
      none: ["no_subscription", "frozen", "blocked"],
    };
    const want = map[filter];
    if (want) list = list.filter((m) => want.includes(m.state));
  }

  return ok({ members: list, count: list.length });
});

/** POST /api/members — create a member and their first subscription */
export const POST = handler(async (req: NextRequest) => {
  await requireSession();

  const b = await body<any>(req);
  const name = str(b.name, 160);
  const rawPhone = str(b.phone, 30);
  if (!name) return fail("Name is required", 422);
  if (!rawPhone) return fail("Phone is required", 422);

  const phone = normalizePhone(rawPhone);
  if (phone.length < 8) return fail("Phone number looks invalid", 422);

  const gender = b.gender === "female" ? "female" : "male";
  const birthDate = str(b.birthDate, 10) || null;
  const notes = str(b.notes, 1000) || null;

  // plan resolution
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
    if (!b.price && b.price !== 0) price = Number(p.price);
    if (sessions < 0) sessions = Number(p.sessions ?? 0);
  }
  if (sessions < 0) sessions = 0;

  if (durationDays < 1) return fail("Duration must be at least 1 day", 422);
  if (durationDays > 3650) return fail("Duration is too long", 422);
  if (!planLabel) planLabel = `${durationDays} days`;

  const paid = num(b.paid, price);
  const startISO = str(b.startDate, 10) || toISODate(today());
  const start = dayOf(startISO);
  const end = addDays(start, durationDays - 1);

  const serial = await nextSerial();
  const qrToken = randomUUID();

  const m = await exec(
    `INSERT INTO members (serial, qr_token, full_name, phone, gender, birth_date, notes, status)
     VALUES (?,?,?,?,?,?,?, 'active')`,
    [serial, qrToken, name, phone, gender, birthDate, notes]
  );

  await exec(
    `INSERT INTO subscriptions
       (member_id, plan_id, plan_label, duration_days, sessions_total, sessions_used,
        start_date, end_date, price, paid, status)
     VALUES (?,?,?,?,?,0,?,?,?,?, ?)`,
    [
      m.insertId,
      planId,
      planLabel,
      durationDays,
      sessions,
      toISODate(start),
      toISODate(end),
      price,
      paid,
      dayOf(toISODate(end)) >= today() ? "active" : "expired",
    ]
  );

  await notify({
    type: "member_added",
    memberId: m.insertId,
    titleAr: "عميل جديد",
    titleEn: "New member",
    bodyAr: `${name} (${serial}) — ${planLabel}`,
    bodyEn: `${name} (${serial}) — ${planLabel}`,
    severity: "success",
  });

  const [created] = await fetchMembers(`WHERE m.id = ?`, [m.insertId]);
  return ok({ member: created }, 201);
});
