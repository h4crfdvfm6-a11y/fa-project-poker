import { sql } from "./db";
import { leaveTable } from "./table-play";

/**
 * Players leave cash tables when they go back to the lobby (or sit somewhere
 * else), and a seated player we haven't heard from for AWAY_SECONDS is taken
 * off too. Mid-hand they're marked to leave and go as soon as the hand ends;
 * their chips go back to their club balance.
 */
const AWAY_SECONDS = 60;

let ready: Promise<void> | null = null;
export function ensurePresenceSchema() {
  ready ??= (async () => {
    await sql(`alter table table_seats add column if not exists last_seen_at timestamptz`);
    await sql(
      `alter table table_seats add column if not exists leave_requested boolean not null default false`,
    );
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

/** The player is looking at this table right now. */
export async function markSeen(tableId: string, memberId: string) {
  await ensurePresenceSchema();
  await sql(
    `update table_seats set last_seen_at = now(), leave_requested = false
     where table_id = $1 and member_id = $2`,
    [tableId, memberId],
  );
}

/** Empty seats start clean, so the next player doesn't inherit a leave flag. */
async function resetEmptySeats(tableId: string) {
  await sql(
    `update table_seats set leave_requested = false, last_seen_at = null
     where table_id = $1 and member_id is null and (leave_requested or last_seen_at is not null)`,
    [tableId],
  );
}

/** Leave now if between hands, otherwise as soon as this hand ends. */
export async function requestLeave(tableId: string, memberId: string) {
  await ensurePresenceSchema();
  try {
    await leaveTable(tableId, memberId);
    await resetEmptySeats(tableId);
    return "left" as const;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Not seated")) return "not-seated" as const;
    await sql(
      `update table_seats set leave_requested = true where table_id = $1 and member_id = $2`,
      [tableId, memberId],
    );
    return "after-hand" as const;
  }
}

/** Cash tables (not tournaments) this player is sitting at. */
async function seatedTables(memberId: string) {
  return sql<{ table_id: string }>(
    `select s.table_id from table_seats s
     join cash_tables t on t.id = s.table_id
     where s.member_id = $1 and not s.is_bot and coalesce(t.format, 'ring') <> 'tournament'`,
    [memberId],
  );
}

/** Back in the lobby (or sitting elsewhere): leave every other cash table. */
export async function leaveAllTables(memberId: string, exceptTableId?: string) {
  await ensurePresenceSchema();
  for (const r of await seatedTables(memberId)) {
    if (r.table_id === exceptTableId) continue;
    await requestLeave(r.table_id, memberId).catch(() => undefined);
  }
}

/** True if this player still has chips sitting on another table. */
export async function chipsOnOtherTable(memberId: string, tableId: string) {
  return (await seatedTables(memberId)).some((r) => r.table_id !== tableId);
}

/** On every table poll: take off players who asked to leave or went away. */
export async function processPendingLeaves(tableId: string) {
  await ensurePresenceSchema();
  const rows = await sql<{ member_id: string }>(
    `select s.member_id from table_seats s
     join cash_tables t on t.id = s.table_id
     where s.table_id = $1 and s.member_id is not null and not s.is_bot
       and coalesce(t.format, 'ring') <> 'tournament'
       and (s.leave_requested or s.last_seen_at < now() - interval '${AWAY_SECONDS} seconds')`,
    [tableId],
  );
  let left = false;
  for (const r of rows) {
    try {
      await leaveTable(tableId, r.member_id); // only works between hands
      left = true;
    } catch {
      // hand still running — try again on the next poll
    }
  }
  if (left) await resetEmptySeats(tableId);
}

/** Has the player to act asked to leave (then the timer acts for them at once)? */
export async function wantsToLeave(tableId: string, memberId: string) {
  await ensurePresenceSchema();
  const [r] = await sql<{ leave_requested: boolean }>(
    `select leave_requested from table_seats where table_id = $1 and member_id = $2`,
    [tableId, memberId],
  );
  return Boolean(r?.leave_requested);
}
