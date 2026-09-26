import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { handler, ok, fail, int } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireSession();
  if (session.role !== "owner") return fail("Owner access only", 403);
  const id = int((await ctx.params).id);
  const person = await q1<{ qr_token: string; serial: string; full_name: string }>(
    `SELECT qr_token,serial,full_name FROM staff WHERE id=?`, [id]
  );
  if (!person) return fail("Staff not found", 404);
  const payload = `TS1:${person.qr_token}`;
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M", width: Math.max(180, Math.min(800, int(req.nextUrl.searchParams.get("size"), 450))),
    margin: 2, color: { dark: "#0A0C11", light: "#FFFFFF" },
  });
  return ok({ payload, dataUrl, serial: person.serial, name: person.full_name });
});
