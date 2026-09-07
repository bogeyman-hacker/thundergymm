import { humanDuration } from "./subs";

/** Strip everything but digits; drop a leading 00 / +. */
export function normalizePhone(raw: string, defaultCountry = "20"): string {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  // Local Egyptian style: 01xxxxxxxxx → 201xxxxxxxxx
  if (p.startsWith("0") && p.length >= 10) p = defaultCountry + p.slice(1);
  return p;
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export type TemplateKind = "welcome" | "mid" | "end" | "expired" | "manual";

type Ctx = {
  gym: string;
  name: string;
  serial: string;
  left: number;
  total: number;
  plan: string;
  endDate: string;
  lang: "ar" | "en";
};

/** Builds the WhatsApp body text for a member reminder. */
export function buildMessage(kind: TemplateKind, c: Ctx): string {
  const ar = c.lang === "ar";
  const dur = humanDuration(c.left, c.lang);

  if (kind === "welcome") {
    return ar
      ? `أهلاً ${c.name} 👋\nتم تفعيل اشتراكك في ${c.gym} بنجاح.\n\n• الكود: ${c.serial}\n• الباقة: ${c.plan}\n• المدة: ${humanDuration(c.total, "ar")}\n• ينتهي في: ${c.endDate}\n\nاحتفظ بكود الـ QR بتاعك، هتعمل بيه سكان عند الدخول 💪`
      : `Hi ${c.name} 👋\nYour ${c.gym} membership is now active.\n\n• Code: ${c.serial}\n• Plan: ${c.plan}\n• Duration: ${humanDuration(c.total, "en")}\n• Expires: ${c.endDate}\n\nKeep your QR code handy — you'll scan it on entry 💪`;
  }

  if (kind === "mid") {
    return ar
      ? `أهلاً ${c.name} 👋\nفاضل على انتهاء اشتراكك في ${c.gym} ${dur} (ينتهي ${c.endDate}).\n\nلسه معاك وقت، بس حبينا نفكّرك 🙂\nلو حابب تجدد بدري كلّمنا في أي وقت.`
      : `Hi ${c.name} 👋\nYou have ${dur} left on your ${c.gym} membership (ends ${c.endDate}).\n\nStill plenty of time — just a friendly heads-up 🙂\nRenew early any time.`;
  }

  if (kind === "end") {
    return ar
      ? `تنبيه ⚠️\n${c.name}، اشتراكك في ${c.gym} هينتهي خلال ${dur} — آخر يوم ${c.endDate}.\n\nجدّد دلوقتي عشان متقطعش تمرينك 💪`
      : `Heads-up ⚠️\n${c.name}, your ${c.gym} membership ends in ${dur} — last day ${c.endDate}.\n\nRenew now so you don't miss a session 💪`;
  }

  if (kind === "expired") {
    return ar
      ? `${c.name}، اشتراكك في ${c.gym} انتهى بتاريخ ${c.endDate}.\n\nنورنا وجدّد في أي وقت، حسابك وكود الـ QR بتاعك (${c.serial}) لسه شغالين ✅`
      : `${c.name}, your ${c.gym} membership expired on ${c.endDate}.\n\nCome back any time — your account and QR code (${c.serial}) are still valid ✅`;
  }

  return ar
    ? `أهلاً ${c.name}، رسالة من ${c.gym}.`
    : `Hi ${c.name}, a message from ${c.gym}.`;
}

/** Short digest sent to the gym owner's own WhatsApp. */
export function buildAdminDigest(
  lang: "ar" | "en",
  gym: string,
  rows: { name: string; serial: string; left: number; phone: string }[]
): string {
  const ar = lang === "ar";
  const head = ar
    ? `📋 ${gym} — عملاء قرب اشتراكهم يخلص (${rows.length}):\n`
    : `📋 ${gym} — memberships running out (${rows.length}):\n`;
  const body = rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} (${r.serial}) — ${
          ar ? `فاضل ${humanDuration(r.left, "ar")}` : `${humanDuration(r.left, "en")} left`
        }`
    )
    .join("\n");
  return head + body;
}
