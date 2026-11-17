import { closeTable, DEFAULT_CLUB_ID } from "./club";
import { sql } from "./db";
import { id } from "./ids";

/**
 * Remove a player from the club. Their chips are taken back (recorded in the
 * chip ledger) and they disappear from the admin list and can't sit again.
 * Not allowed while they are sitting at a table.
 */
export async function removeMember(memberId: string) {
  const [member] = await sql<{ id: string; role: string; chip_balance: string | number }>(
    `select id, role, chip_balance from members where id = $1 and club_id = $2`,
    [memberId, DEFAULT_CLUB_ID],
  );
  if (!member) throw new Error("Player not found");
  if (member.role === "system" || member.role === "bot") {
    throw new Error("This account can't be removed");
  }
  const seated = await sql(`select 1 from table_seats where member_id = $1 limit 1`, [memberId]);
  if (seated.length) {
    throw new Error("Player is sitting at a table — remove them after they leave");
  }
  const balance = Number(member.chip_balance) || 0;
  await sql(
    `update members set status = 'removed', chip_balance = 0 where id = $1`,
    [memberId],
  );
  if (balance !== 0) {
    await sql(
      `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
       values ($1, $2, $3, $4, 'admin_remove_player', 'admin')`,
      [id("led"), DEFAULT_CLUB_ID, memberId, -balance],
    );
  }
}

/** Is this player removed from the club? */
export async function isRemoved(memberId: string) {
  const [row] = await sql<{ status: string }>(`select status from members where id = $1`, [
    memberId,
  ]);
  return !row || row.status === "removed";
}

/**
 * Delete a table: it is closed first (everyone seated is paid back their
 * stack), then hidden from the admin list for good.
 */
export async function deleteTable(tableId: string) {
  await closeTable(tableId);
  await sql(`update cash_tables set status = 'deleted' where id = $1 and club_id = $2`, [
    tableId,
    DEFAULT_CLUB_ID,
  ]);
}
