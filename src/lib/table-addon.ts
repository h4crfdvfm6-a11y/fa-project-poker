import { sql, withTransaction } from "./db";
import { num } from "./club";
import { id } from "./ids";
import { ensureTablePlaySchema } from "./table-schema";

/**
 * Add chips at the table (cash games only), like GG Poker's "Add chips".
 * Chips are never added in the middle of a hand: the request waits and is
 * added before the next deal. The club chips are only taken when the chips
 * are actually added, so nothing needs refunding if you leave first.
 * Your stack can't go above the table's maximum buy-in.
 */
export async function requestAddOn(
  tableId: string,
  memberId: string,
  amount: number,
) {
  await ensureTablePlaySchema();
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Enter how many chips to add");
  amount = Math.floor(amount);
  const [table] = await sql<{
    format: string;
    status: string;
    buyin_max: string | number;
  }>(`select format, status, buyin_max from cash_tables where id = $1`, [
    tableId,
  ]);
  if (!table || table.status !== "open") throw new Error("Table not open");
  if (table.format === "tournament")
    throw new Error("No adding chips in tournaments");
  const [seat] = await sql<{ stack: string | number; is_bot: boolean }>(
    `select stack, is_bot from table_seats where table_id = $1 and member_id = $2`,
    [tableId, memberId],
  );
  if (!seat || seat.is_bot) throw new Error("Not seated");
  const room = num(table.buyin_max) - num(seat.stack);
  if (room <= 0)
    throw new Error(
      `You already have the table maximum (${num(table.buyin_max)})`,
    );
  if (amount > room) throw new Error(`You can add up to ${Math.floor(room)}`);
  const [member] = await sql<{ chip_balance: string | number }>(
    `select chip_balance from members where id = $1`,
    [memberId],
  );
  if (!member || num(member.chip_balance) < amount)
    throw new Error("Not enough club chips");

  await sql(
    `insert into table_addons (table_id, member_id, amount) values ($1, $2, $3)
     on conflict (table_id, member_id) do update set amount = excluded.amount, created_at = now()`,
    [tableId, memberId, amount],
  );

  // No hand running (waiting for players): add them straight away.
  const [rt] = await sql<{ phase: string }>(
    `select phase from table_runtime where table_id = $1`,
    [tableId],
  );
  if (!rt || rt.phase === "waiting") {
    const added = await applyPendingAddOns(tableId);
    return { added: added > 0 };
  }
  return { added: false };
}

/** Chips you asked to add that are waiting for the next deal (0 if none). */
export async function pendingAddOn(tableId: string, memberId: string | null) {
  if (!memberId) return 0;
  const rows = await sql<{ amount: string | number }>(
    `select amount from table_addons where table_id = $1 and member_id = $2`,
    [tableId, memberId],
  ).catch(() => []);
  return rows[0] ? num(rows[0].amount) : 0;
}

/**
 * Put waiting add-ons on the stacks. Called between hands only, right before
 * the next deal. Claiming the rows with DELETE ... RETURNING means only one
 * poller ever adds them.
 */
export async function applyPendingAddOns(tableId: string) {
  return withTransaction(async (q) => {
    const [table] = await q<{
      status: string;
      format: string;
      buyin_max: string;
      club_id: string;
    }>(
      "select status, format, buyin_max, club_id from cash_tables where id = $1 for update",
      [tableId],
    );
    if (!table || table.status !== "open" || table.format === "tournament")
      return 0;
    const [runtime] = await q<{
      phase: string;
      state_json: string;
      hand_no: number;
      settled_hand_no: number;
    }>(
      "select phase, state_json, hand_no, settled_hand_no from table_runtime where table_id = $1 for update",
      [tableId],
    );
    // Requests can be made mid-hand; only a between-hand caller may fund them.
    if (runtime?.phase === "hand") return 0;
    if (
      runtime?.phase === "showdown" &&
      runtime.settled_hand_no !== runtime.hand_no
    )
      return 0;
    const claimed = await q<{ member_id: string; amount: string }>(
      "delete from table_addons where table_id = $1 returning member_id, amount",
      [tableId],
    );
    const state = runtime?.state_json ? JSON.parse(runtime.state_json) : {};
    let applied = 0;
    for (const row of claimed) {
      const [seat] = await q<{ stack: string }>(
        "select stack from table_seats where table_id = $1 and member_id = $2 and is_bot = false for update",
        [tableId, row.member_id],
      );
      if (!seat) continue;
      const add = Math.min(
        num(row.amount),
        Math.max(0, num(table.buyin_max) - num(seat.stack)),
      );
      if (add <= 0) continue;
      const paid = await q(
        `update members set chip_balance = chip_balance - $2
        where id = $1 and status = 'active' and chip_balance >= $2 returning id`,
        [row.member_id, add],
      );
      if (!paid.length) continue;
      await q(
        `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
        values ($1,$2,$3,$4,$5,'player')`,
        [
          id("led"),
          table.club_id,
          row.member_id,
          -add,
          `table_addon:${tableId}`,
        ],
      );
      await q(
        "update table_seats set stack = stack + $3, sitting_out = false where table_id = $1 and member_id = $2",
        [tableId, row.member_id, add],
      );
      const current = state.seats?.find(
        (s: { memberId: string }) => s.memberId === row.member_id,
      );
      if (current) current.stack = num(seat.stack) + add;
      applied++;
    }
    if (applied && runtime) {
      // Invalidate any concurrent next-deal snapshot and show the new stack immediately.
      await q(
        "update table_runtime set state_json = $2, version = version + 1, updated_at = now() where table_id = $1",
        [tableId, JSON.stringify(state)],
      );
    }
    return applied;
  });
}
