import { q1, tx } from "./db";
import { notify } from "./notify";

/** Employee QR uses a different namespace from member QRs. */
export async function scanStaff(raw: string, mode: "lookup" | "checkin") {
  let code = raw.trim();
  let kind: "token" | "serial";
  if (/^TS1:[0-9a-f-]{36}$/i.test(code)) {
    kind = "token"; code = code.slice(4).toLowerCase();
  } else if (/^EMP-?\d{1,10}$/i.test(code)) {
    kind = "serial";
    code = `EMP-${code.replace(/^EMP-?/i, "").padStart(6, "0")}`;
  } else return null;

  const person = await q1<{
    id: number; serial: string; full_name: string; job_title: string; active: number;
  }>(`SELECT id,serial,full_name,job_title,active FROM staff WHERE ${kind === "token" ? "qr_token" : "serial"}=?`, [code]);
  if (!person) return { entity: "staff", mode, found: false, granted: false, reason: "unknown" };
  const staff = { id: person.id, serial: person.serial, name: person.full_name,
                  jobTitle: person.job_title, active: !!person.active };
  const open = await q1<{ id: number }>(
    `SELECT id FROM staff_attendance WHERE staff_id=? AND clock_out IS NULL
     ORDER BY id DESC LIMIT 1`, [person.id]
  );
  if (mode === "lookup" || !person.active)
    return { entity: "staff", mode, found: true, granted: !!person.active,
      reason: person.active ? null : "inactive", staff,
      nextAction: open ? "checkout" : "checkin" };

  const outcome = await tx(async (conn) => {
    const [rows] = await conn.query(`SELECT active FROM staff WHERE id=? FOR UPDATE`, [person.id]);
    if (!(rows as { active: number }[])[0]?.active)
      return { action: "inactive", duplicate: false };
    const [recent] = await conn.query(
      `SELECT id, clock_in, clock_out FROM staff_attendance
       WHERE staff_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE`, [person.id]
    );
    const last = (recent as { id: number; clock_in: Date; clock_out: Date | null }[])[0];
    const previous = last?.clock_out ?? last?.clock_in;
    // Block accidental rapid re-scans before either clock-in or clock-out.
    if (previous && Date.now() - new Date(previous).getTime() < 120000)
      return { action: last.clock_out ? "checkin" : "checkout", duplicate: true };
    if (last && !last.clock_out) {
      await conn.execute(`UPDATE staff_attendance SET clock_out=NOW() WHERE id=?`, [last.id]);
      return { action: "checkout", duplicate: false };
    }
    await conn.execute(`INSERT INTO staff_attendance (staff_id) VALUES (?)`, [person.id]);
    return { action: "checkin", duplicate: false };
  });
  if (outcome.action === "inactive") return { entity: "staff", mode, found: true,
    granted: false, reason: "inactive", staff };
  if (!outcome.duplicate) await notify({
    type: "staff_attendance", memberId: null,
    titleAr: outcome.action === "checkin" ? "حضور موظف" : "انصراف موظف",
    titleEn: outcome.action === "checkin" ? "Staff clock-in" : "Staff clock-out",
    bodyAr: `${person.full_name} (${person.serial})`, bodyEn: `${person.full_name} (${person.serial})`,
    severity: "info",
  });
  return { entity: "staff", mode, found: true, granted: true, duplicate: outcome.duplicate,
    reason: null, staff, action: outcome.action,
    nextAction: outcome.action === "checkin" ? "checkout" : "checkin" };
}
