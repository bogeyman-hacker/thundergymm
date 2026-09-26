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

export type TemplateKind =
  | "welcome"   // first day of a brand-new membership
  | "renewed"   // subscription renewed
  | "mid"       // half-way through
  | "end"       // about to run out
  | "expired"   // already finished
  | "sessions"  // punch card nearly empty
  | "manual";

type Ctx = {
  gym: string;
  name: string;
  serial: string;
  left: number;        // days remaining
  total: number;       // plan length in days
  plan: string;
  endDate: string;
  lang: "ar" | "en";
  startDate?: string;
  sessionsLeft?: number;
  sessionsTotal?: number;
  sessionsUsed?: number;
};

/* ── formatting helpers ──────────────────────────────────────── */

const LINE = "━━━━━━━━━━━━━━━";

/** "١٥ حصة" / "15 sessions" */
function sessionWord(n: number, lang: "ar" | "en"): string {
  if (lang === "en") return `${n} session${n === 1 ? "" : "s"}`;
  if (n === 1) return "حصة واحدة";
  if (n === 2) return "حصتين";
  if (n <= 10) return `${n} حصص`;
  return `${n} حصة`;
}

/** Describes the rhythm of a punch card: 15 in 30 days → "يوم و يوم". */
function paceLabel(total: number, days: number, lang: "ar" | "en"): string {
  if (!total || !days) return "";
  const ratio = total / days;
  if (ratio >= 0.9) return lang === "ar" ? "كل يوم" : "daily";
  if (ratio >= 0.45) return lang === "ar" ? "يوم و يوم" : "every other day";
  if (ratio >= 0.28) return lang === "ar" ? "٣ أيام في الأسبوع" : "3 days a week";
  if (ratio >= 0.2) return lang === "ar" ? "يومين في الأسبوع" : "2 days a week";
  return lang === "ar" ? "مرة في الأسبوع" : "once a week";
}

/** The subscription summary block shared by several templates. */
function details(c: Ctx): string {
  const ar = c.lang === "ar";
  const hasSessions = (c.sessionsTotal ?? 0) > 0;
  const pace = hasSessions ? paceLabel(c.sessionsTotal!, c.total, c.lang) : "";

  const rows: string[] = [];
  rows.push(ar ? `🏷️ الباقة: ${c.plan}` : `🏷️ Plan: ${c.plan}`);
  rows.push(
    ar
      ? `⏳ المدة: ${humanDuration(c.total, "ar")}`
      : `⏳ Duration: ${humanDuration(c.total, "en")}`
  );
  if (hasSessions) {
    rows.push(
      ar
        ? `🎟️ الحصص: ${sessionWord(c.sessionsTotal!, "ar")}${pace ? ` (${pace})` : ""}`
        : `🎟️ Sessions: ${sessionWord(c.sessionsTotal!, "en")}${pace ? ` (${pace})` : ""}`
    );
  }
  if (c.startDate) {
    rows.push(ar ? `📅 من: ${c.startDate}` : `📅 From: ${c.startDate}`);
  }
  rows.push(ar ? `🏁 حتى: ${c.endDate}` : `🏁 Until: ${c.endDate}`);
  rows.push(ar ? `🔖 الكود: ${c.serial}` : `🔖 Code: ${c.serial}`);
  return rows.join("\n");
}

/** Remaining-balance line — sessions take priority when the plan has them. */
function remaining(c: Ctx): string {
  const ar = c.lang === "ar";
  const hasSessions = (c.sessionsTotal ?? 0) > 0;
  const sl = c.sessionsLeft ?? 0;

  if (hasSessions) {
    return ar
      ? `🎟️ فاضلك: ${sessionWord(sl, "ar")}\n📆 وآخر موعد: ${c.endDate} (${humanDuration(c.left, "ar")})`
      : `🎟️ Remaining: ${sessionWord(sl, "en")}\n📆 Valid until: ${c.endDate} (${humanDuration(c.left, "en")})`;
  }
  return ar
    ? `📆 فاضلك: ${humanDuration(c.left, "ar")} (ينتهي ${c.endDate})`
    : `📆 Remaining: ${humanDuration(c.left, "en")} (ends ${c.endDate})`;
}

/* ── templates ───────────────────────────────────────────────── */

export function buildMessage(kind: TemplateKind, c: Ctx): string {
  const ar = c.lang === "ar";
  const hasSessions = (c.sessionsTotal ?? 0) > 0;

  /* أول يوم — welcome */
  if (kind === "welcome") {
    return ar
      ? `أهلاً بيك يا ${c.name} 👋💪
مبروك، اشتراكك في *${c.gym}* اتفعّل النهاردة.

${LINE}
${details(c)}
${LINE}

📱 كود الـ QR بتاعك هو مفتاح دخولك — اعرضه عند الباب كل مرة.
${hasSessions ? "🎟️ كل دخول بيخصم حصة واحدة من رصيدك.\n" : ""}
مستنينك على أول تمرين! 🔥`
      : `Welcome ${c.name} 👋💪
Your *${c.gym}* membership is active as of today.

${LINE}
${details(c)}
${LINE}

📱 Your QR code is your key — show it at the door every visit.
${hasSessions ? "🎟️ Each entry deducts one session from your balance.\n" : ""}
See you at your first workout! 🔥`;
  }

  /* تجديد — renewed */
  if (kind === "renewed") {
    return ar
      ? `تمام يا ${c.name} ✅
تم تجديد اشتراكك في *${c.gym}*.

${LINE}
${details(c)}
${LINE}

شكراً لثقتك فينا 🙏 يلا نكمّل! 💪`
      : `All set, ${c.name} ✅
Your *${c.gym}* membership has been renewed.

${LINE}
${details(c)}
${LINE}

Thanks for sticking with us 🙏 Let's keep going! 💪`;
  }

  /* نص المدة — mid */
  if (kind === "mid") {
    const half = hasSessions
      ? ar
        ? `خلّصت ${sessionWord(c.sessionsUsed ?? 0, "ar")} من ${sessionWord(c.sessionsTotal ?? 0, "ar")} 👏`
        : `You've completed ${sessionWord(c.sessionsUsed ?? 0, "en")} of ${sessionWord(c.sessionsTotal ?? 0, "en")} 👏`
      : ar
        ? `عدّى نص مدة اشتراكك 👏`
        : `You're half-way through your membership 👏`;

    return ar
      ? `أهلاً ${c.name} 🙂
${half}

${remaining(c)}

لسه معاك وقت كويس — كمّل بنفس الحماس 💪
وأي وقت تحب تجدد بدري، إحنا موجودين.
— *${c.gym}*`
      : `Hi ${c.name} 🙂
${half}

${remaining(c)}

Plenty left — keep the momentum going 💪
Happy to renew early whenever you like.
— *${c.gym}*`;
  }

  /* قرب الانتهاء — end */
  if (kind === "end") {
    const warn = hasSessions
      ? ar
        ? `⚠️ رصيدك قرب يخلص — فاضلك ${sessionWord(c.sessionsLeft ?? 0, "ar")} بس.`
        : `⚠️ Your balance is nearly done — only ${sessionWord(c.sessionsLeft ?? 0, "en")} left.`
      : ar
        ? `⚠️ اشتراكك قرب ينتهي — فاضل ${humanDuration(c.left, "ar")} بس.`
        : `⚠️ Your membership is nearly over — only ${humanDuration(c.left, "en")} left.`;

    return ar
      ? `${c.name}، تنبيه سريع 🔔
${warn}

${remaining(c)}

جدّد دلوقتي عشان متقطعش تمرينك — وكمّل على نفس التقدّم اللي وصلتله 💪
— *${c.gym}*`
      : `${c.name}, quick heads-up 🔔
${warn}

${remaining(c)}

Renew now so you don't break your streak 💪
— *${c.gym}*`;
  }

  /* خلص الرصيد — sessions */
  if (kind === "sessions") {
    return ar
      ? `${c.name} 🎟️
خلّصت كل حصص باقتك (${sessionWord(c.sessionsTotal ?? 0, "ar")}) — تمام التمام! 👏

الاشتراك الحالي انتهى بخلوص الرصيد.
جدّد عشان تكمّل من غير توقف 💪
— *${c.gym}*`
      : `${c.name} 🎟️
You've used all ${sessionWord(c.sessionsTotal ?? 0, "en")} in your plan — great work! 👏

Your current subscription is now complete.
Renew to keep going without a break 💪
— *${c.gym}*`;
  }

  /* انتهى — expired */
  if (kind === "expired") {
    return ar
      ? `${c.name}، اشتراكك في *${c.gym}* انتهى بتاريخ ${c.endDate} 🕓

وحشتنا! 🤍 حسابك وكود الـ QR بتاعك (${c.serial}) لسه شغالين زي ما هما.
تعالى جدّد في أي وقت ونكمّل من حيث ما وقفنا 💪`
      : `${c.name}, your *${c.gym}* membership ended on ${c.endDate} 🕓

We miss you! 🤍 Your account and QR code (${c.serial}) are still valid.
Drop by any time to renew and pick up where you left off 💪`;
  }

  return ar
    ? `أهلاً ${c.name} 👋\nرسالة من *${c.gym}*.`
    : `Hi ${c.name} 👋\nA message from *${c.gym}*.`;
}

/** Short digest sent to the gym owner's own WhatsApp. */
export function buildAdminDigest(
  lang: "ar" | "en",
  gym: string,
  rows: { name: string; serial: string; left: number; phone: string; sessionsLeft?: number }[]
): string {
  const ar = lang === "ar";
  const head = ar
    ? `📋 *${gym}* — عملاء قرب اشتراكهم يخلص (${rows.length}):\n${LINE}\n`
    : `📋 *${gym}* — memberships running out (${rows.length}):\n${LINE}\n`;
  const body = rows
    .map((r, i) => {
      const bal =
        r.sessionsLeft !== undefined && r.sessionsLeft > 0
          ? ar
            ? `${sessionWord(r.sessionsLeft, "ar")}`
            : `${sessionWord(r.sessionsLeft, "en")}`
          : ar
            ? humanDuration(r.left, "ar")
            : humanDuration(r.left, "en");
      return `${i + 1}. ${r.name} (${r.serial}) — ${ar ? `فاضل ${bal}` : `${bal} left`}`;
    })
    .join("\n");
  return head + body;
}
