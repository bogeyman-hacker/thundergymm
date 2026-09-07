import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { handler, ok, fail, body, str } from "@/lib/http";
import { allSettings, setSetting } from "@/lib/notify";
import { normalizePhone } from "@/lib/wa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["gym_name", "admin_phone", "msg_lang", "dup_window_min"]);

export const GET = handler(async () => {
  await requireSession();
  return ok({ settings: await allSettings() });
});

export const POST = handler(async (req: NextRequest) => {
  const s = await requireSession();
  const b = await body<Record<string, any>>(req);

  for (const [k, v] of Object.entries(b)) {
    if (!ALLOWED.has(k)) continue;
    let val = str(v, 200);
    if (k === "admin_phone") val = normalizePhone(val);
    if (k === "msg_lang") val = val === "en" ? "en" : "ar";
    if (k === "dup_window_min") val = String(Math.max(0, Math.min(120, Number(val) || 0)));
    await setSetting(k, val);
  }

  // optional password change
  if (b.newPassword) {
    const pw = str(b.newPassword, 200);
    if (pw.length < 6) return fail("Password must be at least 6 characters", 422);
    await exec(`UPDATE admins SET password_hash = ? WHERE id = ?`, [
      await hashPassword(pw),
      s.uid,
    ]);
  }

  return ok({ settings: await allSettings() });
});
