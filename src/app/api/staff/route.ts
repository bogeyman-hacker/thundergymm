import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q, q1 } from "@/lib/db";
import { handler, ok, fail, body, str, int, num } from "@/lib/http";
import { normalizePhone } from "@/lib/wa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function onlyOwner(role: string) {
  if (role !== "owner") throw Object.assign(new Error("Owner access only"), { status: 403 });
}

export const GET = handler(async () => {
  onlyOwner((await requireSession()).role);
  const staff = await q(`SELECT s.id, s.serial, s.full_name, s.phone, s.job_title,
      s.monthly_salary, s.active, s.created_at,
      (SELECT a.id FROM staff_attendance a
        WHERE a.staff_id=s.id AND a.clock_out IS NULL ORDER BY a.id DESC LIMIT 1) AS open_shift
    FROM staff s ORDER BY s.active DESC, s.full_name`);
  const attendance = await q(`SELECT a.id, a.staff_id, a.clock_in, a.clock_out,
      s.full_name, s.serial FROM staff_attendance a
      JOIN staff s ON s.id=a.staff_id ORDER BY a.id DESC LIMIT 80`);
  return ok({ staff, attendance });
});

export const POST = handler(async (req: NextRequest) => {
  onlyOwner((await requireSession()).role);
  const b = await body<any>(req);
  const name = str(b.name, 160);
  const phone = normalizePhone(str(b.phone, 30));
  const salary = num(b.monthlySalary, 0);
  if (!name || !Number.isFinite(salary) || salary < 0) return fail("Name and valid salary required", 422);
  const r = await exec(
    `INSERT INTO staff (qr_token,full_name,phone,job_title,monthly_salary)
     VALUES (?,?,?,?,?)`,
    [randomUUID(), name, phone, str(b.jobTitle, 120), salary]
  );
  const serial = `EMP-${String(r.insertId).padStart(6, "0")}`;
  await exec(`UPDATE staff SET serial=? WHERE id=?`, [serial, r.insertId]);
  return ok({ id: r.insertId, serial }, 201);
});

export const PATCH = handler(async (req: NextRequest) => {
  onlyOwner((await requireSession()).role);
  const b = await body<any>(req);
  const id = int(b.id);
  if (!id || !(await q1(`SELECT id FROM staff WHERE id=?`, [id]))) return fail("Staff not found", 404);
  const sets: string[] = [], p: any[] = [];
  if (b.name !== undefined) { sets.push("full_name=?"); p.push(str(b.name, 160)); }
  if (b.phone !== undefined) { sets.push("phone=?"); p.push(normalizePhone(str(b.phone, 30))); }
  if (b.jobTitle !== undefined) { sets.push("job_title=?"); p.push(str(b.jobTitle, 120)); }
  if (b.monthlySalary !== undefined) {
    const salary = num(b.monthlySalary, -1);
    if (salary < 0) return fail("Invalid salary", 422);
    sets.push("monthly_salary=?"); p.push(salary);
  }
  if (b.active !== undefined) { sets.push("active=?"); p.push(b.active ? 1 : 0); }
  if (!sets.length) return fail("Nothing to update", 422);
  await exec(`UPDATE staff SET ${sets.join(",")} WHERE id=?`, [...p, id]);
  if (b.active === false) {
    await exec(`UPDATE staff_attendance SET clock_out=NOW() WHERE staff_id=? AND clock_out IS NULL`, [id]);
  }
  return ok();
});
