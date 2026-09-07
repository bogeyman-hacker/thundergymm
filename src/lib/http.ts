import { NextResponse } from "next/server";

export function ok(data: any = {}, init?: number) {
  return NextResponse.json({ ok: true, ...data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400, extra: any = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Wrap a route handler with uniform error handling. */
export function handler<T extends any[]>(
  fn: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e: any) {
      const status = e?.status ?? 500;
      if (status === 401) return fail("UNAUTHORIZED", 401);
      console.error("[api]", e?.message, e?.stack);
      const msg =
        e?.code === "ER_NO_SUCH_TABLE"
          ? "Database not initialised — run the setup step."
          : e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND"
          ? "Cannot reach the database. Check DATABASE_URL."
          : e?.code === "ER_DUP_ENTRY"
          ? "Duplicate entry."
          : e?.message || "Server error";
      return fail(msg, status);
    }
  };
}

export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function str(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}

export function int(v: unknown, def = 0): number {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

export function num(v: unknown, def = 0): number {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
