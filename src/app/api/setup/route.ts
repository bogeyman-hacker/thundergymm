import { NextRequest } from "next/server";
import { pool, q, q1, exec } from "@/lib/db";
import { SCHEMA_SQL } from "@/lib/schema";
import { splitSql, stripForeignKeys } from "@/lib/sqlsplit";
import { hashPassword } from "@/lib/auth";
import { handler, ok, fail, body, str } from "@/lib/http";
import { setSetting } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** [name_ar, name_en, duration_days, sessions, price, color] — sessions 0 = unlimited */
const DEFAULT_PLANS: [string, string, number, number, number, string][] = [
  ["يوم واحد", "Day pass", 1, 1, 60, "#94A3B8"],
  ["أسبوع", "1 Week", 7, 7, 250, "#22D3EE"],
  ["شهر — كل يوم", "1 Month — Daily", 30, 30, 700, "#FFC531"],
  ["شهر — يوم و يوم", "1 Month — Alt days", 30, 15, 500, "#FBBF24"],
  ["٣ شهور — كل يوم", "3 Months — Daily", 90, 90, 1800, "#F59E0B"],
  ["٣ شهور — يوم و يوم", "3 Months — Alt days", 90, 45, 1300, "#FB923C"],
  ["٦ شهور — كل يوم", "6 Months — Daily", 180, 180, 3200, "#8B7BFF"],
  ["٦ شهور — يوم و يوم", "6 Months — Alt days", 180, 90, 2400, "#A78BFA"],
  ["سنة — مفتوح", "1 Year — Open", 365, 0, 5500, "#34D399"],
];

/**
 * Columns added after the first release. Re-running setup applies them.
 * "Duplicate column" errors mean the migration already ran — ignore those.
 */
const MIGRATIONS = [
  `ALTER TABLE plans         ADD COLUMN sessions       INT NOT NULL DEFAULT 0`,
  `ALTER TABLE subscriptions ADD COLUMN sessions_total INT NOT NULL DEFAULT 0`,
  `ALTER TABLE subscriptions ADD COLUMN sessions_used  INT NOT NULL DEFAULT 0`,
  `ALTER TABLE subscriptions ADD COLUMN low_attendance_notified_at DATETIME NULL`,
  `ALTER TABLE checkins      ADD COLUMN sessions_left  INT NULL`,
  `ALTER TABLE checkins      ADD COLUMN consumed       TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE members       ADD COLUMN frozen_at      DATE NULL`,
  `ALTER TABLE members       ADD COLUMN freeze_until   DATE NULL`,
];

function alreadyApplied(e: any): boolean {
  const m = String(e?.message ?? "");
  return (
    e?.code === "ER_DUP_FIELDNAME" ||
    e?.errno === 1060 ||
    /duplicate column/i.test(m) ||
    /column .* already exists/i.test(m)
  );
}

async function tablesExist(): Promise<boolean> {
  try {
    await q1(`SELECT 1 FROM admins LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/** GET → report status without changing anything. */
export const GET = handler(async () => {
  const exists = await tablesExist();
  if (!exists) return ok({ installed: false, admins: 0 });
  const row = await q1<{ c: number }>(`SELECT COUNT(*) AS c FROM admins`);
  return ok({ installed: true, admins: Number(row?.c ?? 0) });
});

/**
 * POST → create tables + seed the first owner account.
 * Safe to call twice: it refuses to create a second owner unless the table is empty.
 */
export const POST = handler(async (req: NextRequest) => {
  const b = await body<{
    username?: string;
    password?: string;
    name?: string;
    phone?: string;
    setupToken?: string;
  }>(req);

  // If a SETUP_TOKEN is configured, require it (protects a live deployment).
  const required = process.env.SETUP_TOKEN;
  if (required && str(b.setupToken) !== required) {
    return fail("Invalid setup token", 403);
  }

  // 1. schema
  const conn = await pool().getConnection();
  try {
    for (const stmt of splitSql(SCHEMA_SQL)) {
      try {
        await conn.query(stmt);
      } catch (e: any) {
        // Retry without FK constraints for engines that reject them.
        const fkIssue =
          /foreign key/i.test(e?.message ?? "") ||
          ["ER_CANNOT_ADD_FOREIGN", "ER_FK_INCORRECT_OPTION", "ER_UNSUPPORTED_DDL"].includes(
            e?.code
          );
        if (!fkIssue) throw e;
        await conn.query(stripForeignKeys(stmt));
      }
    }
  } finally {
    conn.release();
  }

  // 1b. migrations for databases created by an older release
  const migrated: string[] = [];
  for (const sql of MIGRATIONS) {
    try {
      await exec(sql);
      migrated.push(sql.split("ADD COLUMN")[1]?.trim().split(/\s+/)[0] ?? sql);
    } catch (e: any) {
      if (!alreadyApplied(e)) throw e;
    }
  }

  // 2. plans (only if empty)
  const planCount = await q1<{ c: number }>(`SELECT COUNT(*) AS c FROM plans`);
  if (Number(planCount?.c ?? 0) === 0) {
    let i = 0;
    for (const [ar, en, days, sessions, price, color] of DEFAULT_PLANS) {
      await exec(
        `INSERT INTO plans (name_ar, name_en, duration_days, sessions, price, color, sort_order)
         VALUES (?,?,?,?,?,?,?)`,
        [ar, en, days, sessions, price, color, i++]
      );
    }
  }

  // On an existing gym, never alter prices or member balances. Add the two
  // missing alternate-day templates INACTIVE at price zero; the owner sets
  // real prices and enables them before using them for new members.
  for (const [ar, en, days, sessions, color] of [
    ["٣ شهور — يوم و يوم", "3 Months — Alt days", 90, 45, "#FB923C"],
    ["٦ شهور — يوم و يوم", "6 Months — Alt days", 180, 90, "#A78BFA"],
  ] as [string, string, number, number, string][]) {
    const found = await q1<{ id: number }>(
      `SELECT id FROM plans WHERE duration_days=? AND sessions=? LIMIT 1`, [days, sessions]
    );
    if (!found) await exec(
      `INSERT INTO plans (name_ar,name_en,duration_days,sessions,price,color,active,sort_order)
       VALUES (?,?,?,?,0,?,0,99)`, [ar, en, days, sessions, color]
    );
  }

  // Import older subscription payments only once. New payment events are
  // inserted by the membership routes, so NEVER backfill a sub with events.
  const oldSubs = await q<{ id: number; member_id: number; paid: string; created_at: string }>(
    `SELECT id, member_id, paid, created_at FROM subscriptions WHERE paid > 0 ORDER BY member_id, id`
  );
  for (const sub of oldSubs) {
    const existing = await q1<{ id: number }>(`SELECT id FROM payments WHERE subscription_id = ? LIMIT 1`, [sub.id]);
    if (existing) continue;
    const first = await q1<{ id: number }>(`SELECT MIN(id) AS id FROM subscriptions WHERE member_id = ?`, [sub.member_id]);
    await exec(
      `INSERT IGNORE INTO payments (subscription_id, member_id, kind, amount, paid_at, legacy_key)
       VALUES (?,?,?,?,?,?)`,
      [sub.id, sub.member_id, first?.id === sub.id ? "new" : "renewal", sub.paid,
       sub.created_at, `legacy:${sub.id}`]
    );
  }

  // 3. settings defaults
  const defaults: [string, string][] = [
    ["gym_name", process.env.NEXT_PUBLIC_GYM_NAME || "ThunderGym"],
    ["admin_phone", process.env.ADMIN_PHONE || ""],
    ["msg_lang", "ar"],
    ["dup_window_min", "2"],
  ];
  for (const [k, v] of defaults) {
    await exec(`INSERT IGNORE INTO settings (skey, svalue) VALUES (?, ?)`, [k, v]);
  }

  // 4. first admin
  const adminCount = await q1<{ c: number }>(`SELECT COUNT(*) AS c FROM admins`);
  let created = false;
  if (Number(adminCount?.c ?? 0) === 0) {
    const username = (str(b.username, 60) || "admin").toLowerCase();
    const password = str(b.password, 200) || "thunder123";
    const name = str(b.name, 120) || "Gym Owner";
    const phone = str(b.phone, 30) || process.env.ADMIN_PHONE || "";
    await exec(
      `INSERT INTO admins (name, username, phone, password_hash, role) VALUES (?,?,?,?, 'owner')`,
      [name, username, phone, await hashPassword(password)]
    );
    created = true;
  }

  return ok({ installed: true, adminCreated: created, migrated });
});
