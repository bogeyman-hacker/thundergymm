import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { exec } from "@/lib/db";
import { handler, ok, fail, body, str, int } from "@/lib/http";
import { fetchMembers } from "@/lib/queries";
import { dueReminder } from "@/lib/subs";
import { toSubRowFromDTO } from "@/lib/scanHelpers";
import { buildMessage, buildAdminDigest, waLink } from "@/lib/wa";
import { getSetting, sweepExpired } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reminders
 * Everyone who is due a WhatsApp message right now, with the text and the
 * wa.me deep-link already built.
 */
export const GET = handler(async () => {
  await requireSession();
  await sweepExpired();

  const gym = (await getSetting("gym_name")) || process.env.NEXT_PUBLIC_GYM_NAME || "ThunderGym";
  const lang = ((await getSetting("msg_lang")) || "ar") as "ar" | "en";
  const adminPhone = (await getSetting("admin_phone")) || process.env.ADMIN_PHONE || "";

  const members = await fetchMembers(`ORDER BY m.full_name ASC LIMIT 2000`);

  const items = members
    .filter((m) => m.sub && m.memberStatus === "active")
    .map((m) => {
      const sub = toSubRowFromDTO(m);
      let kind: "mid" | "end" | "expired" | null = null;

      if (m.state === "expired") {
        kind = m.sub!.endSent ? null : "expired";
      } else {
        kind = dueReminder(sub);
      }
      if (!kind) return null;

      const text = buildMessage(kind, {
        gym,
        name: m.name,
        serial: m.serial,
        left: m.daysLeft,
        total: m.totalDays,
        plan: m.sub!.plan,
        endDate: m.sub!.end,
        lang,
      });

      return {
        memberId: m.id,
        subscriptionId: m.sub!.id,
        name: m.name,
        serial: m.serial,
        phone: m.phone,
        gender: m.gender,
        plan: m.sub!.plan,
        endDate: m.sub!.end,
        daysLeft: m.daysLeft,
        totalDays: m.totalDays,
        kind,
        text,
        link: waLink(m.phone, text),
      };
    })
    .filter(Boolean) as any[];

  items.sort((a, b) => a.daysLeft - b.daysLeft);

  const digest = adminPhone
    ? waLink(
        adminPhone,
        buildAdminDigest(
          lang,
          gym,
          items.slice(0, 25).map((i) => ({
            name: i.name,
            serial: i.serial,
            left: i.daysLeft,
            phone: i.phone,
          }))
        )
      )
    : null;

  return ok({ reminders: items, adminDigestLink: digest, adminPhone });
});

/**
 * POST /api/reminders  { subscriptionId, kind, memberId }
 * Records that the message was sent so it isn't offered again.
 */
export const POST = handler(async (req: NextRequest) => {
  await requireSession();
  const b = await body<{
    subscriptionId: number;
    memberId: number;
    kind: "mid" | "end" | "expired";
    text?: string;
    phone?: string;
  }>(req);

  const subId = int(b.subscriptionId);
  const memberId = int(b.memberId);
  const kind = str(b.kind, 12);

  if (!subId || !memberId) return fail("subscriptionId and memberId are required", 422);
  if (!["mid", "end", "expired", "manual", "welcome"].includes(kind))
    return fail("Unknown reminder kind", 422);

  if (kind === "mid") {
    await exec(`UPDATE subscriptions SET mid_notified_at = NOW() WHERE id = ?`, [subId]);
  } else if (kind === "end" || kind === "expired") {
    await exec(`UPDATE subscriptions SET end_notified_at = NOW() WHERE id = ?`, [subId]);
  }

  await exec(
    `INSERT INTO wa_log (member_id, subscription_id, kind, phone, body, status, sent_at)
     VALUES (?,?,?,?,?, 'sent', NOW())`,
    [memberId, subId, kind, str(b.phone, 30), str(b.text, 2000)]
  );

  return ok({ marked: true });
});
