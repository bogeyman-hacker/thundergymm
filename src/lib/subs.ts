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
  /** 0 = unlimited entry (open plan). >0 = punch-card plan. */
  sessions_total: number;
  sessions_used: number;
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

/** Gym business day, not the UTC day of a Vercel server. */
export function today(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (key: string) => Number(parts.find((p) => p.type === key)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
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

/**
 * One mid-cycle alert per active session plan when attendance is below half
 * the plan's expected pace. Example: 30 sessions / 30 days, on day 16 the
 * member should have attended about 15 times; 7 visits triggers an alert.
 * On a 15-in-30 plan, 7 visits at mid-cycle does NOT trigger it.
 */
export function lowAttendanceDue(
  sub: Pick<SubRow, "start_date" | "end_date" | "duration_days" | "sessions_total" | "sessions_used" | "status">,
  alreadyNotified: boolean,
  from: Date = today()
): boolean {
  const duration = Number(sub.duration_days);
  const total = Number(sub.sessions_total);
  const used = Number(sub.sessions_used);
  if (alreadyNotified || sub.status !== "active" || duration < 14 || total <= 0) return false;
  const elapsed = Math.round((from.getTime() - dayOf(sub.start_date).getTime()) / MS_DAY);
  if (elapsed < Math.ceil(duration / 2) || elapsed >= duration) return false;
  if (daysLeft(sub.end_date, from) <= 0 || used >= total) return false;
  return used * 2 < (elapsed * total) / duration;
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

  // A punch-card plan can run out of sessions long before its end date,
  // so evaluate both clocks and fire on whichever is further along.
  let sEnd = false;
  let sMid = false;
  if (isSessionPlan(sub)) {
    const sl = sessionsLeft(sub);
    const total = Number(sub.sessions_total);
    sEnd = sl <= sessionEndThreshold(total);
    sMid = !sEnd && sl <= sessionMidThreshold(total);
  }

  if ((left <= endT || sEnd) && !sub.end_notified_at) return "end";

  const midByDays = left <= midT && left > endT;
  if ((midByDays || sMid) && !sub.mid_notified_at) return "mid";

  return null;
}

/* ── Sessions (جلسات) ──────────────────────────────────────────
 * A plan can be limited by TIME, by SESSIONS, or by both.
 *   شهر كل يوم        → 30 sessions / 30 days
 *   شهر يوم و يوم     → 15 sessions / 30 days
 *   3 شهور يوم و يوم  → 45 sessions / 90 days
 *   6 شهور يوم و يوم  → 90 sessions / 180 days
 * Whichever limit runs out first ends the subscription.
 * sessions_total = 0 means "unlimited entries until the end date".
 */

export function isSessionPlan(sub: Pick<SubRow, "sessions_total"> | null): boolean {
  return !!sub && Number(sub.sessions_total) > 0;
}

export function sessionsLeft(sub: Pick<SubRow, "sessions_total" | "sessions_used"> | null): number {
  if (!isSessionPlan(sub)) return 0;
  return Math.max(0, Number(sub!.sessions_total) - Number(sub!.sessions_used));
}

/** How few sessions remain before we call the member "expiring". */
export function sessionEndThreshold(total: number): number {
  if (total <= 4) return 1;
  if (total <= 15) return 2;
  if (total <= 45) return 3;
  return 5;
}

/** Half-way point of a punch card, e.g. 15 sessions → 8 left. */
export function sessionMidThreshold(total: number): number {
  return Math.max(sessionEndThreshold(total) + 1, Math.ceil(total / 2));
}

/** Sessions per week implied by the plan — 15 in 30 days ≈ every other day. */
export function sessionPace(sub: Pick<SubRow, "sessions_total" | "duration_days">): number {
  const d = Number(sub.duration_days) || 1;
  const t = Number(sub.sessions_total) || 0;
  return t > 0 ? Math.round((t / d) * 70) / 10 : 0;
}

export type MemberState =
  | "active"
  | "expiring"
  | "expired"
  | "no_subscription"
  | "not_started"
  | "frozen"
  | "blocked";

export function memberState(
  memberStatus: "active" | "frozen" | "blocked",
  sub: SubRow | null,
  from: Date = today()
): {
  state: MemberState;
  left: number;
  total: number;
  pct: number;
  sessionsLeft: number;
  sessionsTotal: number;
  sessionsUsed: number;
} {
  const total = sub?.duration_days ?? 0;
  const left = sub ? daysLeft(sub.end_date, from) : 0;

  const sTotal = sub ? Number(sub.sessions_total) || 0 : 0;
  const sUsed = sub ? Number(sub.sessions_used) || 0 : 0;
  const sLeft = sTotal > 0 ? Math.max(0, sTotal - sUsed) : 0;

  // Progress follows whichever budget is more depleted.
  const dayPct = total > 0 ? (left / total) * 100 : 0;
  const sesPct = sTotal > 0 ? (sLeft / sTotal) * 100 : 100;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round(Math.min(dayPct, sesPct)))) : 0;

  const base = { left, total, pct, sessionsLeft: sLeft, sessionsTotal: sTotal, sessionsUsed: sUsed };

  if (memberStatus === "blocked") return { state: "blocked", ...base };
  if (memberStatus === "frozen") return { state: "frozen", ...base };
  if (!sub || sub.status === "cancelled")
    return { state: "no_subscription", ...base, left: 0, pct: 0 };

  // Out of days OR out of sessions → finished.
  if (from.getTime() < dayOf(sub.start_date).getTime())
    return { state: "not_started", ...base, left: total, pct: 100 };
  if (left <= 0) return { state: "expired", ...base, left: 0, pct: 0 };
  if (sTotal > 0 && sLeft <= 0) return { state: "expired", ...base, pct: 0 };

  const lowDays = left <= endThreshold(total);
  const lowSessions = sTotal > 0 && sLeft <= sessionEndThreshold(sTotal);
  if (lowDays || lowSessions) return { state: "expiring", ...base };

  return { state: "active", ...base };
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
    if (lang === "ar") {
      // Arabic counts: 1 → singular word, 2 → dual, 3-10 → plural, 11+ → singular again.
      if (n === 1) parts.push(ar[0]);
      else if (n === 2) parts.push(ar[1]);
      else if (n <= 10) parts.push(`${n} ${ar[2]}`);
      else parts.push(`${n} ${ar[0]}`);
    }
    else parts.push(`${n} ${n === 1 ? en[0] : en[1]}`);
  };
  push(y, ["سنة", "سنتان", "سنوات"], ["year", "years"]);
  push(mo, ["شهر", "شهران", "شهور"], ["month", "months"]);
  push(d, ["يوم", "يومان", "أيام"], ["day", "days"]);
  return parts.slice(0, 2).join(lang === "ar" ? " و" : " ");
}
