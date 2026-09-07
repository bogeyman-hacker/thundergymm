import { NextRequest } from "next/server";
import { q1 } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { handler, ok, fail, body, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  const b = await body<{ username: string; password: string }>(req);
  const username = str(b.username, 60).toLowerCase();
  const password = str(b.password, 200);

  if (!username || !password) return fail("Missing credentials", 400);

  const row = await q1<{
    id: number;
    name: string;
    username: string;
    password_hash: string;
    role: "owner" | "staff";
  }>(`SELECT id, name, username, password_hash, role FROM admins WHERE username = ? LIMIT 1`, [
    username,
  ]);

  if (!row) return fail("INVALID", 401);
  const good = await verifyPassword(password, row.password_hash);
  if (!good) return fail("INVALID", 401);

  await createSession({
    uid: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
  });

  return ok({ user: { id: row.id, name: row.name, username: row.username, role: row.role } });
});
