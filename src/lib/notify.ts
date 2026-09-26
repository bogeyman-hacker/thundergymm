import { exec, q, q1, tx } from "./db";
import { daysLeft, daysUsed, lowAttendanceDue, today, toISODate } from "./subs";
import { releaseScheduledFreezes } from "./freeze";

export type NotifInput = {
  type: string;
  memberId?: number | null;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  severity?: "info" | "success" | "warning" | "danger";
};

export async function notify(n: NotifInput): Promise<number> {
  const r = await exec(
    `INSERT INTO notifications (type, member_id, title_ar, title_en, body_ar, body_en, severity)
     VALUES (?,?,?,?,?,?,?)`,
    [
      n.type,
      n.memberId ?? null,
      n.titleAr,
      n.titleEn,
      n.bodyAr,
      n.bodyEn,
      n.severity ?? "info",
    ]
  );
  // keep the table lean
  await exec(
    `DELETE FROM notifications WHERE created_at < (NOW() - INTERVAL 30 DAY) AND is_read = 1`
  );
  return r.insertId;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await q1<{ svalue: string }>(`SELECT svalue FROM settings WHERE skey = ?`, [key]);
  return row?.svalue ?? fallback;
}

export async function allSettings(): Promise<Record<string, string>> {
  const rows = await q<{ skey: string; svalue: string }>(`SELECT skey, svalue FROM settings`);
  return Object.fromEntries(rows.map((r) => [r.skey, r.svalue]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await exec(
    `INSERT INTO settings (skey, svalue) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)`,
    [key, value]
  );
}

/** Flip any subscription whose end_date has passed to 'expired'. Cheap, idempotent. */
export async function sweepExpired(): Promise<number> {
  await releaseScheduledFreezes();
  const r = await exec(
    `UPDATE subscriptions SET status = 'expired'
     WHERE status = 'active' AND end_date < ?
       AND NOT EXISTS (SELECT 1 FROM members m
                        WHERE m.id = subscriptions.member_id AND m.status = 'frozen')`,
    [toISODate(today())]
  );
  return r.affectedRows;
}

/**
 * Give the owner ONE in-app alert per subscription when a session member is
 * attending at less than half their expected pace after the halfway point.
 * This runs opportunistically when the signed-in admin's bell polls — no paid
 * cron service, push provider, or unsolicited member WhatsApp message.
 */
export async function sweepLowAttendance(): Promise<number> {
  const now = today();
  const iso = toISODate(now);
  const rows = await q<{
    id: number; member_id: number; full_name: string; serial: string;
    start_date: string; end_date: string; duration_days: number;
    sessions_total: number; sessions_used: number; plan_sessions: number | null;
    status: "active"; low_attendance_notified_at: string | null;
  }>(
    `SELECT s.id, s.member_id, m.full_name, m.serial,
            s.start_date, s.end_date, s.duration_days, s.sessions_total,
            s.sessions_used, p.sessions AS plan_sessions,
            s.status, s.low_attendance_notified_at
       FROM subscriptions s
       JOIN members m ON m.id = s.member_id
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'active' AND m.status = 'active'
        AND (s.sessions_total > 0 OR p.sessions > 0)
        AND s.duration_days >= 14
        AND s.low_attendance_notified_at IS NULL
        AND s.start_date <= ? AND s.end_date >= ?
        AND DATEDIFF(?, s.start_date) >= CEIL(s.duration_days / 2)
      ORDER BY s.id DESC LIMIT 3000`,
    [iso, iso, iso]
  );

  let created = 0;
  for (const sub of rows) {
    // Subscriptions predating session accounting have sessions_total=0.
    // Use the plan's current session target and count historical DISTINCT
    // visit dates for the alert ONLY; never backfill/deduct their balance.
    const legacy = Number(sub.sessions_total) <= 0;
    const total = legacy ? Number(sub.plan_sessions ?? 0) : Number(sub.sessions_total);
    let used = Number(sub.sessions_used);
    if (legacy) {
      const hit = await q1<{ visits: number }>(
        `SELECT COUNT(DISTINCT DATE(scanned_at)) AS visits
           FROM checkins
          WHERE subscription_id = ? AND result = 'granted'
            AND DATE(scanned_at) BETWEEN ? AND ?`,
        [sub.id, sub.start_date, iso]
      );
      used = Number(hit?.visits ?? 0);
    }
    const effective = { ...sub, sessions_total: total, sessions_used: used };
    if (!lowAttendanceDue(effective, !!sub.low_attendance_notified_at, now)) continue;
    const elapsed = daysUsed(sub, now);
    const expected = Math.round((elapsed * total) / Number(sub.duration_days));
    const left = daysLeft(sub.end_date, now);

    // The conditional UPDATE is a single-winner claim across concurrent Vercel
    // instances; the notification is inserted in the SAME transaction.
    const inserted = await tx(async (conn) => {
      const [res] = await conn.execute(
        `UPDATE subscriptions SET low_attendance_notified_at = NOW()
          WHERE id = ? AND status = 'active' AND low_attendance_notified_at IS NULL`,
        [sub.id]
      );
      if (!(res as { affectedRows: number }).affectedRows) return false;
      await conn.execute(
        `INSERT INTO notifications
           (type, member_id, title_ar, title_en, body_ar, body_en, severity)
         VALUES (?,?,?,?,?,?, 'warning')`,
        [
          "low_attendance", sub.member_id,
          "متابعة عميل — حضوره أقل من المتوقع",
          "Member follow-up — low attendance",
          `${sub.full_name} (${sub.serial}) حضر ${used} من حوالي ${expected} حصة متوقعة بعد ${elapsed} يوم. فاضل ${left} يوم. ابعتله واطمن عليه.`,
          `${sub.full_name} (${sub.serial}) attended ${used} of about ${expected} expected sessions after ${elapsed} days. ${left} days remain. Check in with them.`,
        ]
      );
      return true;
    });
    if (inserted) created++;
  }
  return created;
}
