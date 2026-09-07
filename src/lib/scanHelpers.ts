import type { MemberDTO } from "./queries";
import type { SubRow } from "./subs";

export { dueReminder } from "./subs";

/** Rebuild a SubRow from an already-shaped MemberDTO. */
export function toSubRowFromDTO(m: MemberDTO): SubRow {
  return {
    id: m.sub!.id,
    member_id: m.id,
    plan_label: m.sub!.plan,
    duration_days: m.sub!.days,
    start_date: m.sub!.start,
    end_date: m.sub!.end,
    price: m.sub!.price,
    paid: m.sub!.paid,
    status: m.sub!.status as SubRow["status"],
    mid_notified_at: m.sub!.midSent ? "sent" : null,
    end_notified_at: m.sub!.endSent ? "sent" : null,
  };
}
