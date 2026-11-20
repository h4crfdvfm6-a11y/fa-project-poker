import { sql } from "./db";
import { num, sendChips } from "./club";

/**
 * Add chips at the table (cash games only), like GG Poker's "Add chips".
 * Chips are never added in the middle of a hand: the request waits and is
 * added before the next deal. The club chips are only taken when the chips
 * are actually added, so nothing needs refunding if you leave first.
 * Your stack can't go above the table's maximum buy-in.
 */
export async function requestAddOn(tableId: string, memberId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter how many chips to add");
  amount = Math.floor(amount);
  const [table] = await sql<{ format: string; status: string; buyin_max: string | number }>(
    `select format, status, buyin_max from cash_tables where id = $1`,
    [tableId],
  );
  if (!table || table.status !== "open") throw new Error("Table not open");
  if (table.format === "tournament") throw new Error("No adding chips in tournaments");
  const [seat] = await sql<{ stack: string | number; is_bot: boolean }>(
    `select stack, is_bot from table_seats where table_id = $1 and member_id = $2`,
    [tableId, memberId],
  );
  if (!seat || seat.is_bot) throw new Error("Not seated");
  const room = num(table.buyin_max) - num(seat.stack);
  if (room <= 0) throw new Error(`You already have the table maximum (${num(table.buyin_max)})`);
  if (amount > room) throw new Error(`You can add up to ${Math.floor(room)}`);
  const [member] = await sql<{ chip_balance: string | number }>(
    `select chip_balance from members where id = $1`,
    [memberId],
  );
  if (!member || num(member.chip_balance) < amount) throw new Error("Not enough club chips");

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
    await applyPendingAddOns(tableId);
    return { added: true };
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
  const claimed = await sql<{ member_id: string; amount: string | number }>(
    `delete from table_addons where table_id = $1 returning member_id, amount`,
    [tableId],
  ).catch(() => [] as Array<{ member_id: string; amount: string | number }>);
  let applied = 0;
  for (const row of claimed) {
    const [seat] = await sql<{ stack: string | number; buyin_max: string | number }>(
      `select s.stack, t.buyin_max
       from table_seats s join cash_tables t on t.id = s.table_id
       where s.table_id = $1 and s.member_id = $2 and s.is_bot = false and t.status = 'open'`,
      [tableId, row.member_id],
    );
    if (!seat) continue; // left the table: nothing was taken
    const add = Math.min(num(row.amount), Math.max(0, num(seat.buyin_max) - num(seat.stack)));
    if (add <= 0) continue;
    try {
      await sendChips(row.member_id, -add, `table_addon:${tableId}`);
    } catch {
      continue; // not enough club chips any more
    }
    const updated = await sql(
      `update table_seats set stack = stack + $3
       where table_id = $1 and member_id = $2
       returning seat_no`,
      [tableId, row.member_id, add],
    );
    if (!updated.length) {
      await sendChips(row.member_id, add, `table_addon_refund:${tableId}`);
      continue;
    }
    applied++;
  }
  return applied;
}
