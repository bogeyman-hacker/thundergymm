import mysql from "mysql2/promise";

/**
 * A single shared pool. In dev, Next.js hot-reloads modules, so we cache the
 * pool on globalThis to avoid opening a new pool on every reload.
 */
declare global {
  // eslint-disable-next-line no-var
  var __tg_pool: mysql.Pool | undefined;
}

function buildPool(): mysql.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
    );
  }

  const u = new URL(url);
  const needsSsl =
    u.searchParams.get("ssl") !== null ||
    u.searchParams.get("sslaccept") === "strict" ||
    /planetscale|aivencloud|tidbcloud|railway|neon|clever-cloud/i.test(u.hostname);

  return mysql.createPool({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 8),
    maxIdle: 4,
    idleTimeout: 30_000,
    enableKeepAlive: true,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    dateStrings: ["DATE"],
    ...(needsSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}

export function pool(): mysql.Pool {
  if (!global.__tg_pool) global.__tg_pool = buildPool();
  return global.__tg_pool;
}

/** SELECT helper — returns typed rows. */
export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool().query(sql, params);
  return rows as T[];
}

/** SELECT helper — returns the first row or null. */
export async function q1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows.length ? rows[0] : null;
}

/** INSERT / UPDATE / DELETE helper. */
export async function exec(
  sql: string,
  params: any[] = []
): Promise<{ insertId: number; affectedRows: number }> {
  const [res] = await pool().execute(sql, params);
  const r = res as mysql.ResultSetHeader;
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

/** Run a set of statements inside one transaction. */
export async function tx<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
