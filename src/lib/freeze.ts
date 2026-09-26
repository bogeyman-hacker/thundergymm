import { q, tx } from "./db";
import { addDays, dayOf, today, toISODate } from "./subs";

/** Calendar days elapsed from freezing up to (but not including) resume date. */
function pausedDays(from: string, until: string): number {
  return Math.max(0, Math.round((dayOf(until).getTime() - dayOf(from).getTime()) / 86400000));
}

/** Start an actual pause. A fixed-duration freeze resumes automatically. */
export async function freezeMember(id: number, days: number | null = null): Promise<void> {
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365))
    throw Object.assign(new Error("Freeze duration must be 1–365 days"), { status: 422 });
  const iso = toISODate(today());
  await tx(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, status FROM members WHERE id = ? FOR UPDATE`, [id]
    );
    const member = (rows as { id: number; status: string }[])[0];
    if (!member) throw Object.assign(new Error("Member not found"), { status: 404 });
    if (member.status === "frozen") throw Object.assign(new Error("Already frozen"), { status: 409 });
    if (member.status !== "active") throw Object.assign(new Error("Member must be active"), { status: 422 });
    const [subs] = await conn.query(
      `SELECT id FROM subscriptions WHERE member_id = ? AND status = 'active'
         AND start_date <= ? AND end_date >= ? LIMIT 1`, [id, iso, iso]
    );
    if (!(subs as unknown[]).length)
      throw Object.assign(new Error("No active subscription to freeze"), { status: 422 });
    await conn.execute(
      `UPDATE members SET status='frozen', frozen_at=?, freeze_until=? WHERE id=?`,
      [iso, days === null ? null : toISODate(addDays(today(), days)), id]
    );
  });
}

/** Resume membership, adding EVERY paused calendar day to its end date.
 * All scheduled future subscriptions move too, so they cannot overlap. */
export async function unfreezeMember(id: number, scheduledResume?: string): Promise<number> {
  // A scheduled pause ends at the requested date even if nobody opens the
  // dashboard until days later; never grant extra days because of idle time.
  const iso = scheduledResume ?? toISODate(today());
  return tx(async (conn) => {
    const [rows] = await conn.query(
      `SELECT status, frozen_at FROM members WHERE id = ? FOR UPDATE`, [id]
    );
    const member = (rows as { status: string; frozen_at: string | null }[])[0];
    if (!member) throw Object.assign(new Error("Member not found"), { status: 404 });
    if (member.status !== "frozen") return 0;
    // A freeze made by an older release had no recorded start date. Let it
    // unfreeze safely; we cannot invent a historical pause duration.
    if (!member.frozen_at) {
      await conn.execute(`UPDATE members SET status='active', frozen_at=NULL, freeze_until=NULL WHERE id=?`, [id]);
      return 0;
    }
    const pause = pausedDays(String(member.frozen_at), iso);
    if (pause) {
      await conn.execute(
        `UPDATE subscriptions
            SET end_date = DATE_ADD(end_date, INTERVAL ? DAY),
                start_date = CASE WHEN start_date > ?
                  THEN DATE_ADD(start_date, INTERVAL ? DAY) ELSE start_date END
          WHERE member_id = ? AND status = 'active' AND end_date >= ?`,
        [pause, member.frozen_at, pause, id, member.frozen_at]
      );
    }
    await conn.execute(
      `UPDATE members SET status='active', frozen_at=NULL, freeze_until=NULL WHERE id=?`, [id]
    );
    return pause;
  });
}

/** Called by the existing opportunistic sweep (no cron service required). */
export async function releaseScheduledFreezes(): Promise<number> {
  const rows = await q<{ id: number; freeze_until: string }>(
    `SELECT id, freeze_until FROM members WHERE status='frozen' AND freeze_until IS NOT NULL AND freeze_until <= ?`,
    [toISODate(today())]
  );
  for (const row of rows) await unfreezeMember(row.id, row.freeze_until);
  return rows.length;
}
