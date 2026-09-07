import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { handler, ok, fail, int } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const QR_PREFIX = "TG1:";

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireSession();
  const id = int((await ctx.params).id);

  const m = await q1<{ qr_token: string; serial: string; full_name: string }>(
    `SELECT qr_token, serial, full_name FROM members WHERE id = ?`,
    [id]
  );
  if (!m) return fail("Member not found", 404);

  const payload = QR_PREFIX + m.qr_token;
  const size = Math.min(1200, Math.max(160, int(req.nextUrl.searchParams.get("size"), 520)));

  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#0A0C11", light: "#FFFFFF" },
  });

  return ok({ dataUrl, payload, serial: m.serial, name: m.full_name });
});
