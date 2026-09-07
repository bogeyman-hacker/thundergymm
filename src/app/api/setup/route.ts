import { NextRequest } from "next/server";
import { pool, q1, exec } from "@/lib/db";
import { SCHEMA_SQL } from "@/lib/schema";
import { splitSql, stripForeignKeys } from "@/lib/sqlsplit";
import { hashPassword } from "@/lib/auth";
import { handler, ok, fail, body, str } from "@/lib/http";
import { setSetting } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PLANS: [string, string, number, number, string][] = [
  ["يوم واحد", "Day pass", 1, 60, "#94A3B8"],
  ["أسبوع", "1 Week", 7, 250, "#22D3EE"],
  ["شهر", "1 Month", 30, 700, "#FFC531"],
  ["٣ شهور", "3 Months", 90, 1800, "#F59E0B"],
  ["٦ شهور", "6 Months", 180, 3200, "#8B7BFF"],
  ["سنة", "1 Year", 365, 5500, "#34D399"],
];

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

  // 2. plans (only if empty)
  const planCount = await q1<{ c: number }>(`SELECT COUNT(*) AS c FROM plans`);
  if (Number(planCount?.c ?? 0) === 0) {
    let i = 0;
    for (const [ar, en, days, price, color] of DEFAULT_PLANS) {
      await exec(
        `INSERT INTO plans (name_ar, name_en, duration_days, price, color, sort_order) VALUES (?,?,?,?,?,?)`,
        [ar, en, days, price, color, i++]
      );
    }
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

  return ok({ installed: true, adminCreated: created });
});
