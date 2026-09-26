import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec, q1 } from "@/lib/db";
import { handler, ok, fail, body, str } from "@/lib/http";
import { MEMBER_SELECT, shapeMember, type MemberRaw } from "@/lib/queries";
import { dueReminder, toSubRowFromDTO } from "@/lib/scanHelpers";
import { isSessionPlan } from "@/lib/subs";
import { buildMessage, waLink } from "@/lib/wa";
import { getSetting, notify, sweepExpired } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QR_PREFIX = "TG1:";

/** Accepts a raw QR payload, a bare uuid, or a member serial (TG-000123). */
function parseCode(raw: string): { kind: "token" | "serial"; value: string } | null {
  let s = raw.trim();
  if (!s) return null;

  // Someone may have encoded a full URL, e.g. https://site/m/<token>
  const urlMatch = s.match(/\/m\/([0-9a-fA-F-]{36})/);
  if (urlMatch) return { kind: "token", value: urlMatch[1].toLowerCase() };

  if (s.toUpperCase().startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length);
  s = s.trim();

  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) {
    return { kind: "token", value: s.toLowerCase() };
  }
  if (/^TG-?\d{1,10}$/i.test(s)) {
    const n = s.replace(/^TG-?/i, "");
    return { kind: "serial", value: `TG-${n.padStart(6, "0")}` };
  }
  if (/^\d{1,10}$/.test(s)) {
    return { kind: "serial", value: `TG-${s.padStart(6, "0")}` };
  }
  return null;
}

export const POST = handler(async (req: NextRequest) => {
  const session = await requireSession();
  await sweepExpired();

  const b = await body<{ code: string; source?: string; mode?: string }>(req);

  /**
   * lookup  → identify the member and report their status, change nothing.
   * checkin → record the entry and, on a punch-card plan, burn one session.
   * The scanner-gun flow always does "lookup" first, then "checkin" only when
   * the operator presses «تسجيل يوم».
   */
  const mode: "lookup" | "checkin" = b.mode === "lookup" ? "lookup" : "checkin";

  const parsed = parseCode(str(b.code, 300));
  if (!parsed) {
    return ok({ mode, found: false, granted: false, reason: "unknown" });
  }

  const where =
    parsed.kind === "token" ? `WHERE m.qr_token = ? LIMIT 1` : `WHERE m.serial = ? LIMIT 1`;
  const row = await q1<MemberRaw>(`${MEMBER_SELECT} ${where}`, [parsed.value]);

  if (!row) {
    return ok({ mode, found: false, granted: false, reason: "unknown" });
  }

  const member = shapeMember(row);
  const gymName = (await getSetting("gym_name")) || process.env.NEXT_PUBLIC_GYM_NAME || "ThunderGym";
  const msgLang = ((await getSetting("msg_lang")) || "ar") as "ar" | "en";
  const dupMin = Math.max(0, Number((await getSetting("dup_window_min")) || "2"));

  // ── would this entry be allowed? (no writes yet) ───────────
  let result:
    | "granted"
    | "denied_expired"
    | "denied_none"
    | "denied_blocked"
    | "denied_frozen" = "granted";
  let reason: string | null = null;

  switch (member.state) {
    case "blocked":
      result = "denied_blocked"; reason = "blocked"; break;
    case "frozen":
      result = "denied_frozen"; reason = "frozen"; break;
    case "no_subscription":
      result = "denied_none"; reason = "none"; break;
    case "expired":
      result = "denied_expired";
      reason = member.isSessionPlan && member.sessionsLeft <= 0 ? "no_sessions" : "expired";
      break;
    default:
      result = "granted"; reason = null;
  }

  const usesSessions = !!member.sub && isSessionPlan({ sessions_total: member.sub.sessionsTotal });

  // Has a session already been burned today? (one entry per calendar day)
  const todayHit = member.sub
    ? await q1<{ id: number }>(
        `SELECT id FROM checkins
          WHERE member_id = ? AND subscription_id = ? AND consumed = 1
            AND DATE(scanned_at) = CURDATE()
          ORDER BY id DESC LIMIT 1`,
        [member.id, member.sub.id]
      )
    : null;
  const countedToday = !!todayHit;

  // ── LOOKUP: report only, never touch the database ──────────
  if (mode === "lookup") {
    return ok({
      mode,
      found: true,
      granted: result === "granted",
      reason,
      member,
      usesSessions,
      countedToday,
      reminder: null,
    });
  }

  // ── duplicate guard ────────────────────────────────────────
  if (dupMin > 0) {
    const dup = await q1<{ id: number; scanned_at: string }>(
      `SELECT id, scanned_at FROM checkins
        WHERE member_id = ? AND result = 'granted'
          AND scanned_at > (NOW() - INTERVAL ? MINUTE)
        ORDER BY scanned_at DESC LIMIT 1`,
      [member.id, dupMin]
    );
    if (dup) {
      return ok({
        mode,
        found: true,
        granted: true,
        duplicate: true,
        reason: "duplicate",
        member,
        usesSessions,
        countedToday,
        reminder: null,
      });
    }
  }

  const granted = result === "granted";

  // ── burn a session (punch-card plans only, once per day) ───
  let consumed = false;
  let sessionsLeftAfter = member.sessionsLeft;

  if (granted && usesSessions && !countedToday) {
    await exec(
      `UPDATE subscriptions
          SET sessions_used = sessions_used + 1
        WHERE id = ? AND sessions_used < sessions_total`,
      [member.sub!.id]
    );
    consumed = true;
    sessionsLeftAfter = Math.max(0, member.sessionsLeft - 1);

    // Card fully punched → close the subscription.
    if (sessionsLeftAfter === 0) {
      await exec(`UPDATE subscriptions SET status = 'expired' WHERE id = ?`, [member.sub!.id]);
    }
  }

  await exec(
    `INSERT INTO checkins
       (member_id, subscription_id, scanned_by, result, days_left, sessions_left, consumed, source)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      member.id,
      member.sub?.id ?? null,
      session.uid,
      result,
      granted ? member.daysLeft : 0,
      usesSessions ? sessionsLeftAfter : null,
      consumed ? 1 : 0,
      str(b.source, 30) || "usb_scanner",
    ]
  );

  // Reflect the deduction in the payload we send back.
  if (consumed && member.sub) {
    member.sessionsUsed += 1;
    member.sessionsLeft = sessionsLeftAfter;
    member.sub.sessionsUsed += 1;
    member.sub.sessionsLeft = sessionsLeftAfter;
  }

  // ── admin notification ─────────────────────────────────────
  if (granted) {
    const soon = member.state === "expiring";
    await notify({
      type: soon ? "checkin_low" : "checkin",
      memberId: member.id,
      titleAr: soon ? "دخول — اشتراك قرب ينتهي" : "دخول عميل",
      titleEn: soon ? "Check-in — expiring soon" : "Member check-in",
      bodyAr: usesSessions
        ? `${member.name} (${member.serial}) — فاضل ${member.sessionsLeft} حصة و ${member.daysLeft} يوم`
        : `${member.name} (${member.serial}) — فاضل ${member.daysLeft} يوم`,
      bodyEn: usesSessions
        ? `${member.name} (${member.serial}) — ${member.sessionsLeft} session(s), ${member.daysLeft} day(s) left`
        : `${member.name} (${member.serial}) — ${member.daysLeft} day(s) left`,
      severity: soon ? "warning" : "success",
    });
  } else {
    await notify({
      type: "denied",
      memberId: member.id,
      titleAr: "محاولة دخول مرفوضة",
      titleEn: "Entry denied",
      bodyAr: `${member.name} (${member.serial}) — ${
        reason === "expired" ? "الاشتراك منتهي" : reason === "frozen" ? "مجمّد" : reason === "blocked" ? "محظور" : "لا يوجد اشتراك"
      }`,
      bodyEn: `${member.name} (${member.serial}) — ${reason}`,
      severity: "danger",
    });
  }

  // ── WhatsApp reminder, if one is due ───────────────────────
  let reminder: { kind: string; text: string; link: string; subscriptionId: number } | null = null;

  if (member.sub) {
    const sub = toSubRowFromDTO(member);
    const kind = member.state === "expired" ? "expired" : dueReminder(sub);
    if (kind) {
      const text = buildMessage(kind as any, {
        gym: gymName,
        name: member.name,
        serial: member.serial,
        left: member.daysLeft,
        total: member.totalDays,
        plan: member.sub.plan,
        endDate: member.sub.end,
        lang: msgLang,
      });
      reminder = {
        kind,
        text,
        link: waLink(member.phone, text),
        subscriptionId: member.sub.id,
      };
    }
  }

  return ok({
    mode,
    found: true,
    granted,
    reason,
    member,
    usesSessions,
    consumed,
    countedToday,
    sessionsLeft: usesSessions ? sessionsLeftAfter : null,
    reminder,
  });
});
