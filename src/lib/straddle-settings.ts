import { sql } from "./db";
import type { StraddleOptions } from "./poker/straddle";

/**
 * Where straddle settings live:
 *  - cash_tables.straddle_enabled / mississippi_enabled — set by the admin
 *  - table_seats.straddle_for / mississippi_for — the member id of the player
 *    who ticked it in their table menu (so a new player in that seat never
 *    inherits someone else's tick).
 * Cash tables only; tournaments never straddle.
 */

let ready: Promise<void> | null = null;
export function ensureStraddleSchema() {
  ready ??= (async () => {
    await sql(
      `alter table cash_tables add column if not exists straddle_enabled boolean not null default false`,
    );
    await sql(
      `alter table cash_tables add column if not exists mississippi_enabled boolean not null default false`,
    );
    await sql(`alter table table_seats add column if not exists straddle_for text`);
    await sql(`alter table table_seats add column if not exists mississippi_for text`);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

type TableFlags = { straddle_enabled: boolean; mississippi_enabled: boolean; format: string | null };

async function tableFlags(tableId: string) {
  await ensureStraddleSchema();
  const [t] = await sql<TableFlags>(
    `select straddle_enabled, mississippi_enabled, format from cash_tables where id = $1`,
    [tableId],
  );
  const cash = Boolean(t) && (t!.format ?? "ring") !== "tournament";
  return {
    straddle: cash && Boolean(t!.straddle_enabled),
    mississippi: cash && Boolean(t!.mississippi_enabled),
  };
}

/** Admin: switch straddles / Mississippi on or off for a cash table. */
export async function setTableStraddle(
  tableId: string,
  flags: { straddle?: boolean; mississippi?: boolean },
) {
  await ensureStraddleSchema();
  if (flags.straddle !== undefined) {
    await sql(`update cash_tables set straddle_enabled = $2 where id = $1`, [
      tableId,
      Boolean(flags.straddle),
    ]);
  }
  if (flags.mississippi !== undefined) {
    await sql(`update cash_tables set mississippi_enabled = $2 where id = $1`, [
      tableId,
      Boolean(flags.mississippi),
    ]);
  }
  return tableFlags(tableId);
}

/** Player: tick / untick Straddle or Mississippi (stays on until unticked). */
export async function setPlayerStraddle(
  tableId: string,
  memberId: string,
  flags: { straddle?: boolean; mississippi?: boolean },
) {
  await ensureStraddleSchema();
  const [seat] = await sql<{ seat_no: number }>(
    `select seat_no from table_seats where table_id = $1 and member_id = $2`,
    [tableId, memberId],
  );
  if (!seat) throw new Error("Sit down first");
  if (flags.straddle !== undefined) {
    await sql(`update table_seats set straddle_for = $3 where table_id = $1 and seat_no = $2`, [
      tableId,
      seat.seat_no,
      flags.straddle ? memberId : null,
    ]);
  }
  if (flags.mississippi !== undefined) {
    await sql(`update table_seats set mississippi_for = $3 where table_id = $1 and seat_no = $2`, [
      tableId,
      seat.seat_no,
      flags.mississippi ? memberId : null,
    ]);
  }
  return straddleView(tableId, memberId);
}

/** What the engine needs when dealing a hand. */
export async function straddleOptions(tableId: string): Promise<StraddleOptions> {
  const flags = await tableFlags(tableId);
  if (!flags.straddle && !flags.mississippi) {
    return { ...flags, straddleSeats: [], mississippiSeats: [] };
  }
  const rows = await sql<{ seat_no: number; straddle: boolean; mississippi: boolean }>(
    `select seat_no,
            (straddle_for is not null and straddle_for = member_id) as straddle,
            (mississippi_for is not null and mississippi_for = member_id) as mississippi
     from table_seats where table_id = $1 and member_id is not null`,
    [tableId],
  );
  return {
    ...flags,
    straddleSeats: rows.filter((r) => r.straddle).map((r) => Number(r.seat_no)),
    mississippiSeats: rows.filter((r) => r.mississippi).map((r) => Number(r.seat_no)),
  };
}

/** For the table screen: what the table allows and what you have ticked. */
export async function straddleView(tableId: string, memberId: string | null) {
  const flags = await tableFlags(tableId);
  let mine = { straddle: false, mississippi: false };
  if (memberId && (flags.straddle || flags.mississippi)) {
    const [r] = await sql<{ straddle: boolean; mississippi: boolean }>(
      `select (straddle_for = member_id) as straddle, (mississippi_for = member_id) as mississippi
       from table_seats where table_id = $1 and member_id = $2`,
      [tableId, memberId],
    );
    if (r) mine = { straddle: Boolean(r.straddle), mississippi: Boolean(r.mississippi) };
  }
  return { ...flags, mine };
}
