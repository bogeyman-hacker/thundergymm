import { exec, q, q1 } from "./db";

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
  const r = await exec(
    `UPDATE subscriptions SET status = 'expired'
     WHERE status = 'active' AND end_date < CURDATE()`
  );
  return r.affectedRows;
}
