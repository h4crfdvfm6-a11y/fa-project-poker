import { sql, withTransaction } from "./db";
import { ensureOnce, hasColumns } from "./schema-once";
import { id } from "./ids";

export const REBUY_WINDOW_MS = 30_000;

export async function ensureRebuySchema() {
  await ensureOnce("tournament-rebuy-v1", async () => {
    if (
      await hasColumns([
        ["tournaments", "rebuy_until_level"],
        ["table_seats", "rebuy_deadline"],
      ])
    )
      return;
    await sql(
      "alter table tournaments add column if not exists rebuy_until_level int not null default 0",
    );
    await sql(
      "alter table table_seats add column if not exists rebuy_hand_no int not null default -1",
    );
    await sql(
      "alter table table_seats add column if not exists rebuy_deadline timestamptz",
    );
    await sql(`create table if not exists tournament_rebuys (
      tournament_id text not null references tournaments(id), member_id text not null references members(id),
      hand_no int not null, created_at timestamptz not null default now(),
      primary key (tournament_id, member_id, hand_no))`);
  });
}

/** Offer a choice once per bust, and hold the next deal for at most 30 seconds. */
export async function offerTournamentRebuys(tableId: string) {
  await ensureRebuySchema();
  await sql(
    `update table_seats s
    set rebuy_hand_no = r.hand_no, rebuy_deadline = now() + interval '30 seconds'
    from tournaments t, table_runtime r
    where t.table_id = $1 and r.table_id = t.table_id and s.table_id = t.table_id
      and t.status = 'running' and t.kind <> 'spin' and t.rebuy_until_level >= t.blind_level
      and t.rebuy_until_level > 0 and s.member_id is not null and not s.is_bot and s.stack <= 0
      and r.phase = 'showdown' and r.settled_hand_no = r.hand_no and s.rebuy_hand_no <> r.hand_no
      and exists (select 1 from jsonb_array_elements(r.state_json::jsonb -> 'seats') h
        where h ->> 'memberId' = s.member_id and jsonb_array_length(h -> 'hole') > 0)`,
    [tableId],
  );
}

export async function hasRebuyDecision(tableId: string) {
  await ensureRebuySchema();
  const rows = await sql(
    `select 1 from table_seats s join tournaments t on t.table_id = s.table_id
    where s.table_id = $1 and t.status = 'running' and t.kind <> 'spin'
      and t.rebuy_until_level > 0 and t.blind_level <= t.rebuy_until_level
      and s.member_id is not null and s.stack <= 0 and s.rebuy_deadline > now() limit 1`,
    [tableId],
  );
  return rows.length > 0;
}

export async function tournamentRebuyView(
  tableId: string,
  memberId: string | null,
) {
  await ensureRebuySchema();
  const [row] = await sql<{
    rebuy_until_level: number;
    blind_level: number;
    status: string;
    kind: string;
    buy_in: string;
    fee: string;
    starting_stack: number;
    rebuy_deadline: string | null;
    chip_balance: string | null;
    stack: string | null;
  }>(
    `select t.rebuy_until_level, t.blind_level, t.status, t.kind, t.buy_in, t.fee, t.starting_stack,
      s.rebuy_deadline, s.stack, m.chip_balance
    from tournaments t left join table_seats s on s.table_id = t.table_id and s.member_id = $2
    left join members m on m.id = s.member_id where t.table_id = $1`,
    [tableId, memberId],
  );
  if (!row) return null;
  const open =
    row.status === "running" &&
    row.kind !== "spin" &&
    row.rebuy_until_level > 0 &&
    row.blind_level <= row.rebuy_until_level;
  const deadline = row.rebuy_deadline
    ? new Date(row.rebuy_deadline).getTime()
    : 0;
  const offered =
    open &&
    row.stack != null &&
    Number(row.stack) <= 0 &&
    deadline > Date.now();
  const cost = Number(row.buy_in) + Number(row.fee);
  return {
    enabled: row.rebuy_until_level > 0 && row.kind !== "spin",
    untilLevel: row.rebuy_until_level,
    cost,
    chips: row.starting_stack,
    deadline: offered ? deadline : null,
    offered,
    canRebuy: offered && Number(row.chip_balance) >= cost,
    reason: !open
      ? "Rebuys are closed for this tournament."
      : !offered
        ? "Rebuy is available after you bust."
        : Number(row.chip_balance) < cost
          ? "Not enough club chips to rebuy."
          : "",
  };
}

/** Debit, ledger, prize pool and restored seat commit together. A retry cannot pay twice. */
export async function rebuyTournament(
  tableId: string,
  memberId: string,
  handNo: number,
  decline = false,
) {
  if (!Number.isInteger(handNo) || handNo < 1) throw new Error("Invalid hand");
  await ensureRebuySchema();
  return withTransaction(async (q) => {
    const [table] = await q<{ status: string }>(
      "select status from cash_tables where id = $1 for update",
      [tableId],
    );
    const [r] = await q<{
      hand_no: number;
      phase: string;
      settled_hand_no: number;
      state_json: string;
    }>(
      "select hand_no, phase, settled_hand_no, state_json from table_runtime where table_id = $1 for update",
      [tableId],
    );
    const [t] = await q<{
      id: string;
      club_id: string;
      status: string;
      kind: string;
      rebuy_until_level: number;
      blind_level: number;
      blind_minutes: number;
      level_started_at: string;
      buy_in: string;
      fee: string;
      starting_stack: number;
    }>("select * from tournaments where table_id = $1 for update", [tableId]);
    if (!t) throw new Error("Tournament not found");
    const previous = await q(
      "select 1 from tournament_rebuys where tournament_id = $1 and member_id = $2 and hand_no = $3",
      [t.id, memberId, handNo],
    );
    if (previous.length) return { rebought: true };
    const [seat] = await q<{
      stack: string;
      rebuy_hand_no: number;
      rebuy_deadline: string | null;
      is_bot: boolean;
    }>(
      "select stack, rebuy_hand_no, rebuy_deadline, is_bot from table_seats where table_id = $1 and member_id = $2 for update",
      [tableId, memberId],
    );
    if (!seat || seat.is_bot) throw new Error("Not seated in this tournament");
    if (seat.rebuy_hand_no !== handNo || r?.hand_no !== handNo)
      throw new Error("This rebuy offer has expired");
    if (decline) {
      await q(
        "update table_seats set rebuy_deadline = null where table_id = $1 and member_id = $2",
        [tableId, memberId],
      );
      return { rebought: false };
    }
    // Check the wall clock as well: a blind-advance poll may not have run yet.
    const extraLevels = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(t.level_started_at).getTime()) /
          (Math.max(1, t.blind_minutes) * 60_000),
      ),
    );
    if (
      table?.status !== "open" ||
      t.status !== "running" ||
      t.kind === "spin" ||
      t.rebuy_until_level <= 0 ||
      t.blind_level + extraLevels > t.rebuy_until_level
    )
      throw new Error("Rebuys are closed for this tournament");
    if (
      r.phase !== "showdown" ||
      r.settled_hand_no !== r.hand_no ||
      Number(seat.stack) > 0 ||
      !seat.rebuy_deadline ||
      new Date(seat.rebuy_deadline).getTime() <= Date.now()
    )
      throw new Error("This rebuy offer has expired");
    const cost = Number(t.buy_in) + Number(t.fee);
    if (!Number.isFinite(cost) || cost < 0 || t.starting_stack <= 0)
      throw new Error("Invalid rebuy settings");
    const paid = await q(
      `update members set chip_balance = chip_balance - $2
      where id = $1 and status = 'active' and chip_balance >= $2 returning id`,
      [memberId, cost],
    );
    if (!paid.length) throw new Error("Not enough club chips to rebuy");
    await q(
      `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
      values ($1,$2,$3,$4,$5,'player')`,
      [id("led"), t.club_id, memberId, -cost, `mtt_rebuy:${t.id}:${handNo}`],
    );
    await q(
      "insert into tournament_rebuys (tournament_id, member_id, hand_no) values ($1,$2,$3)",
      [t.id, memberId, handNo],
    );
    await q(
      "update tournaments set prize_pool = prize_pool + $2 where id = $1",
      [t.id, Number(t.buy_in)],
    );
    await q(
      "update club_rake set total_rake = total_rake + $2, updated_at = now() where club_id = $1",
      [t.club_id, Number(t.fee)],
    );
    await q(
      "update table_seats set stack = $3, sitting_out = false, rebuy_deadline = null where table_id = $1 and member_id = $2",
      [tableId, memberId, t.starting_stack],
    );
    const state = JSON.parse(r.state_json);
    const restored = state.seats?.find(
      (s: { memberId: string }) => s.memberId === memberId,
    );
    if (!restored) throw new Error("Seat no longer belongs to this hand");
    restored.stack = t.starting_stack;
    // Keep the finished hand's cards/result until the next deal.
    await q(
      "update table_runtime set state_json = $2, version = version + 1, updated_at = now() where table_id = $1",
      [tableId, JSON.stringify(state)],
    );
    return { rebought: true };
  });
}
