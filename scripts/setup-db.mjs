/**
 * Local dev helper: create tables, seed plans/settings/admin, and (optionally)
 * generate demo members so the dashboard isn't empty.
 *
 *   node scripts/setup-db.mjs          → schema + admin + plans
 *   node scripts/setup-db.mjs --demo   → also insert ~18 demo members
 */
import fs from "node:fs";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const envFile = fs.existsSync(".env.local") ? ".env.local" : ".env";
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  multipleStatements: true,
  charset: "utf8mb4_unicode_ci",
});

console.log("→ creating schema…");
const sql = fs.readFileSync("db/schema.sql", "utf8");
const statements = sql
  .split("\n")
  .filter((l) => !/^\s*--/.test(l))
  .join("\n")
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);
for (const stmt of statements) await conn.query(stmt);

// [name_ar, name_en, duration_days, sessions, price, color]  sessions 0 = unlimited
const PLANS = [
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

const [[pc]] = await conn.query("SELECT COUNT(*) AS c FROM plans");
if (!pc.c) {
  console.log("→ seeding plans…");
  let i = 0;
  for (const [ar, en, d, ses, p, c] of PLANS) {
    await conn.execute(
      "INSERT INTO plans (name_ar,name_en,duration_days,sessions,price,color,sort_order) VALUES (?,?,?,?,?,?,?)",
      [ar, en, d, ses, p, c, i++]
    );
  }
}

for (const [k, v] of [
  ["gym_name", process.env.NEXT_PUBLIC_GYM_NAME || "ThunderGym"],
  ["admin_phone", process.env.ADMIN_PHONE || ""],
  ["msg_lang", "ar"],
  ["dup_window_min", "2"],
]) {
  await conn.execute("INSERT IGNORE INTO settings (skey,svalue) VALUES (?,?)", [k, v]);
}

const [[ac]] = await conn.query("SELECT COUNT(*) AS c FROM admins");
if (!ac.c) {
  console.log("→ creating admin  (admin / thunder123)");
  await conn.execute(
    "INSERT INTO admins (name,username,phone,password_hash,role) VALUES (?,?,?,?,'owner')",
    ["Gym Owner", "admin", process.env.ADMIN_PHONE || "", await bcrypt.hash("thunder123", 10)]
  );
}

if (process.argv.includes("--demo")) {
  const [[mc]] = await conn.query("SELECT COUNT(*) AS c FROM members");
  if (mc.c) {
    console.log("→ members already exist, skipping demo data");
  } else {
    console.log("→ inserting demo members…");
    const [plans] = await conn.query("SELECT * FROM plans ORDER BY duration_days");
    const names = [
      ["أحمد محمود", "male"], ["كريم السيد", "male"], ["محمد عبد الله", "male"],
      ["يوسف حسن", "male"], ["عمر خالد", "male"], ["مصطفى إبراهيم", "male"],
      ["سارة علي", "female"], ["نورهان مجدي", "female"], ["مريم أشرف", "female"],
      ["هبة سمير", "female"], ["أمينة رضا", "female"],
      ["طارق فؤاد", "male"], ["زياد نبيل", "male"], ["إسلام عادل", "male"],
      ["دينا وائل", "female"], ["ملك حاتم", "female"], ["حسام الدين", "male"],
      ["رنا عصام", "female"],
    ];

    const iso = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    let n = 0;

    for (const [name, gender] of names) {
      n++;
      const plan = plans[Math.floor(Math.random() * plans.length)];
      // spread start dates so we get active / expiring / expired members
      const offset = Math.floor(Math.random() * Math.max(2, plan.duration_days * 1.25));
      const start = new Date(today.getTime() - offset * 86400000);
      const end = new Date(start.getTime() + (plan.duration_days - 1) * 86400000);
      const serial = `TG-${String(n).padStart(6, "0")}`;
      const phone = `2010${String(10000000 + Math.floor(Math.random() * 89999999))}`;

      const [m] = await conn.execute(
        "INSERT INTO members (serial,qr_token,full_name,phone,gender,status) VALUES (?,?,?,?,?,'active')",
        [serial, crypto.randomUUID(), name, phone, gender]
      );
      await conn.execute(
        `INSERT INTO subscriptions (member_id,plan_id,plan_label,duration_days,start_date,end_date,price,paid,status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          m.insertId, plan.id, `${plan.name_ar} / ${plan.name_en}`, plan.duration_days,
          iso(start), iso(end), plan.price, plan.price,
          end >= today ? "active" : "expired",
        ]
      );

      // a few random visits
      const visits = Math.floor(Math.random() * 9);
      for (let v = 0; v < visits; v++) {
        const when = new Date(today.getTime() - Math.floor(Math.random() * 7) * 86400000 - Math.floor(Math.random() * 10) * 3600000);
        await conn.execute(
          "INSERT INTO checkins (member_id,subscription_id,result,days_left,scanned_at) VALUES (?,?,?,?,?)",
          [m.insertId, null, "granted", Math.max(0, Math.round((end - when) / 86400000)), when.toISOString().slice(0, 19).replace("T", " ")]
        );
      }
    }
    console.log(`→ ${names.length} demo members created`);
  }
}

await conn.end();
console.log("✔ done");
