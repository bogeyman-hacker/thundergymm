/**
 * Subscription maths — works for a 1-day pass just as well as a 1-year plan.
 *
 * Reminder policy (the "two messages" rule, generalised):
 *   • MID reminder  → fires once, when remaining days drop to ~half the plan.
 *   • END reminder  → fires once, when the plan is about to run out.
 * Thresholds scale with the plan length so a 1-week pass isn't nagged like a
 * 12-month one.
 */

export type SubRow = {
  id: number;
  member_id: number;
  plan_label: string;
  duration_days: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  price: number | string;
  paid: number | string;
  status: "active" | "expired" | "cancelled";
  mid_notified_at: string | null;
  end_notified_at: string | null;
};

const MS_DAY = 86_400_000;

/** Midnight-normalised UTC date from a YYYY-MM-DD string. */
export function dayOf(d: string | Date): Date {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

/**
 * Days remaining, counting today as a usable day.
 * end_date == today  → 1 day left (today is the last day)
 * end_date == yesterday → 0 (expired)
 */
export function daysLeft(endDate: string, from: Date = today()): number {
  const diff = Math.round((dayOf(endDate).getTime() - from.getTime()) / MS_DAY);
  return Math.max(0, diff + 1);
}

export function daysUsed(sub: Pick<SubRow, "start_date" | "duration_days" | "end_date">, from: Date = today()): number {
  return Math.max(0, sub.duration_days - daysLeft(sub.end_date, from));
}

/** How many days before expiry the "final" reminder should go out. */
export function endThreshold(durationDays: number): number {
  if (durationDays <= 2) return 1;
  if (durationDays <= 10) return 2;
  if (durationDays <= 45) return 3;
  if (durationDays <= 120) return 5;
  return 7;
}

/** How many days left triggers the "half-way" reminder. */
export function midThreshold(durationDays: number): number {
  return Math.max(endThreshold(durationDays) + 1, Math.floor(durationDays / 2));
}

export type ReminderKind = "mid" | "end" | null;

/** Which reminder (if any) this subscription is due for right now. */
export function dueReminder(sub: SubRow, from: Date = today()): ReminderKind {
  if (sub.status !== "active") return null;
  const left = daysLeft(sub.end_date, from);
  const endT = endThreshold(sub.duration_days);
  const midT = midThreshold(sub.duration_days);

  if (left <= endT && !sub.end_notified_at) return "end";
  if (left <= midT && left > endT && !sub.mid_notified_at) return "mid";
  return null;
}

export type MemberState =
  | "active"
  | "expiring"
  | "expired"
  | "no_subscription"
  | "frozen"
  | "blocked";

export function memberState(
  memberStatus: "active" | "frozen" | "blocked",
  sub: SubRow | null,
  from: Date = today()
): { state: MemberState; left: number; total: number; pct: number } {
  const total = sub?.duration_days ?? 0;
  const left = sub ? daysLeft(sub.end_date, from) : 0;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((left / total) * 100))) : 0;

  if (memberStatus === "blocked") return { state: "blocked", left, total, pct };
  if (memberStatus === "frozen") return { state: "frozen", left, total, pct };
  if (!sub || sub.status === "cancelled") return { state: "no_subscription", left: 0, total, pct: 0 };
  if (left <= 0) return { state: "expired", left: 0, total, pct: 0 };
  if (left <= endThreshold(total)) return { state: "expiring", left, total, pct };
  return { state: "active", left, total, pct };
}

/** Pretty duration, e.g. 400 → "1 year 1 month", 9 → "9 days". */
export function humanDuration(days: number, lang: "ar" | "en"): string {
  if (days <= 0) return lang === "ar" ? "منتهي" : "expired";
  const y = Math.floor(days / 365);
  const mo = Math.floor((days % 365) / 30);
  const d = (days % 365) % 30;
  const parts: string[] = [];
  const push = (n: number, ar: [string, string, string], en: [string, string]) => {
    if (!n) return;
    if (lang === "ar") parts.push(n === 1 ? ar[0] : n === 2 ? ar[1] : `${n} ${ar[2]}`);
    else parts.push(`${n} ${n === 1 ? en[0] : en[1]}`);
  };
  push(y, ["سنة", "سنتان", "سنوات"], ["year", "years"]);
  push(mo, ["شهر", "شهران", "شهور"], ["month", "months"]);
  push(d, ["يوم", "يومان", "أيام"], ["day", "days"]);
  return parts.slice(0, 2).join(lang === "ar" ? " و" : " ");
}
