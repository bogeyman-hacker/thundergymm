import { q } from "./db";
import { dayOf, today, memberState, type SubRow, type MemberState } from "./subs";

export const MEMBER_SELECT = `
  SELECT
    m.id, m.serial, m.qr_token, m.full_name, m.phone, m.gender,
    m.birth_date, m.notes, m.status, m.frozen_at, m.freeze_until, m.created_at,
    s.id              AS sub_id,
    s.plan_label      AS sub_plan,
    s.duration_days   AS sub_days,
    s.start_date      AS sub_start,
    s.end_date        AS sub_end,
    s.price           AS sub_price,
    s.paid            AS sub_paid,
    s.status          AS sub_status,
    s.mid_notified_at AS sub_mid,
    s.end_notified_at AS sub_endn,
    s.sessions_total  AS sub_stot,
    s.sessions_used   AS sub_sused,
    (SELECT COUNT(*) FROM checkins c WHERE c.member_id = m.id AND c.result = 'granted') AS visits,
    (SELECT MAX(c.scanned_at) FROM checkins c WHERE c.member_id = m.id AND c.result = 'granted') AS last_visit
  FROM members m
  LEFT JOIN (
    SELECT * FROM (
      SELECT
        s2.*,
        ROW_NUMBER() OVER (
          PARTITION BY s2.member_id
          ORDER BY s2.end_date DESC, s2.id DESC
        ) AS rn
      FROM subscriptions s2
      WHERE s2.status <> 'cancelled'
    ) ranked
    WHERE ranked.rn = 1
  ) s ON s.member_id = m.id
`;

export type MemberRaw = {
  id: number;
  serial: string;
  qr_token: string;
  full_name: string;
  phone: string;
  gender: "male" | "female";
  birth_date: string | null;
  notes: string | null;
  status: "active" | "frozen" | "blocked";
  frozen_at: string | null;
  freeze_until: string | null;
  created_at: string;
  sub_id: number | null;
  sub_plan: string | null;
  sub_days: number | null;
  sub_start: string | null;
  sub_end: string | null;
  sub_price: string | null;
  sub_paid: string | null;
  sub_status: "active" | "expired" | "cancelled" | null;
  sub_mid: string | null;
  sub_endn: string | null;
  sub_stot: number | null;
  sub_sused: number | null;
  visits: number;
  last_visit: string | null;
};

export type MemberDTO = {
  id: number;
  serial: string;
  qrToken: string;
  name: string;
  phone: string;
  gender: "male" | "female";
  birthDate: string | null;
  notes: string | null;
  memberStatus: "active" | "frozen" | "blocked";
  frozenAt: string | null;
  freezeUntil: string | null;
  createdAt: string;
  visits: number;
  lastVisit: string | null;
  sub: {
    id: number;
    plan: string;
    days: number;
    start: string;
    end: string;
    price: number;
    paid: number;
    status: string;
    midSent: boolean;
    endSent: boolean;
    sessionsTotal: number;
    sessionsUsed: number;
    sessionsLeft: number;
  } | null;
  state: MemberState;
  daysLeft: number;
  totalDays: number;
  pct: number;
  /** Punch-card counters, 0 when the plan is time-only. */
  sessionsLeft: number;
  sessionsTotal: number;
  sessionsUsed: number;
  isSessionPlan: boolean;
};

export function toSubRow(r: MemberRaw): SubRow | null {
  if (!r.sub_id) return null;
  return {
    id: r.sub_id,
    member_id: r.id,
    plan_label: r.sub_plan ?? "",
    duration_days: r.sub_days ?? 0,
    start_date: String(r.sub_start),
    end_date: String(r.sub_end),
    price: r.sub_price ?? 0,
    paid: r.sub_paid ?? 0,
    status: (r.sub_status ?? "expired") as SubRow["status"],
    mid_notified_at: r.sub_mid,
    end_notified_at: r.sub_endn,
    sessions_total: Number(r.sub_stot ?? 0),
    sessions_used: Number(r.sub_sused ?? 0),
  };
}

export function shapeMember(r: MemberRaw): MemberDTO {
  const sub = toSubRow(r);
  const st = memberState(r.status, sub, r.status === "frozen" && r.frozen_at ? dayOf(r.frozen_at) : today());
  return {
    id: r.id,
    serial: r.serial,
    qrToken: r.qr_token,
    name: r.full_name,
    phone: r.phone,
    gender: r.gender,
    birthDate: r.birth_date,
    notes: r.notes,
    memberStatus: r.status,
    frozenAt: r.frozen_at,
    freezeUntil: r.freeze_until,
    createdAt: r.created_at,
    visits: Number(r.visits ?? 0),
    lastVisit: r.last_visit,
    sub: sub
      ? {
          id: sub.id,
          plan: sub.plan_label,
          days: sub.duration_days,
          start: sub.start_date,
          end: sub.end_date,
          price: Number(sub.price),
          paid: Number(sub.paid),
          status: sub.status,
          midSent: !!sub.mid_notified_at,
          endSent: !!sub.end_notified_at,
          sessionsTotal: sub.sessions_total,
          sessionsUsed: sub.sessions_used,
          sessionsLeft: Math.max(0, sub.sessions_total - sub.sessions_used),
        }
      : null,
    state: st.state,
    daysLeft: st.left,
    totalDays: st.total,
    pct: st.pct,
    sessionsLeft: st.sessionsLeft,
    sessionsTotal: st.sessionsTotal,
    sessionsUsed: st.sessionsUsed,
    isSessionPlan: st.sessionsTotal > 0,
  };
}

export async function fetchMembers(where = "", params: any[] = []): Promise<MemberDTO[]> {
  const rows = await q<MemberRaw>(`${MEMBER_SELECT} ${where}`, params);
  return rows.map(shapeMember);
}

/** Next member serial, e.g. TG-000042 */
export async function nextSerial(): Promise<string> {
  const rows = await q<{ mx: number | null }>(
    `SELECT MAX(CAST(SUBSTRING(serial, 4) AS UNSIGNED)) AS mx FROM members WHERE serial LIKE 'TG-%'`
  );
  const n = Number(rows[0]?.mx ?? 0) + 1;
  return `TG-${String(n).padStart(6, "0")}`;
}
