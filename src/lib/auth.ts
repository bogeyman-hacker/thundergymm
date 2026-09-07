import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const COOKIE = "tg_session";
const ALG = "HS256";

export type Session = {
  uid: number;
  name: string;
  username: string;
  role: "owner" | "staff";
};

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET missing or too short (need 16+ chars).");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(s: Session): Promise<void> {
  const token = await new SignJWT(s as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret(), { algorithms: [ALG] });
    return {
      uid: Number(payload.uid),
      name: String(payload.name),
      username: String(payload.username),
      role: (payload.role as "owner" | "staff") ?? "staff",
    };
  } catch {
    return null;
  }
}

/** Throws a 401-shaped error when there is no session. Use inside API routes. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) {
    const e = new Error("UNAUTHORIZED") as Error & { status?: number };
    e.status = 401;
    throw e;
  }
  return s;
}
