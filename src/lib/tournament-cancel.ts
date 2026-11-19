import { DEFAULT_CLUB_ID, getTournament, num, sendChips } from "./club";
import { sql } from "./db";

/**
 * Cancel a tournament that hasn't started: everyone who registered gets their
 * buy-in and fee back, and the fee comes back out of the club's rake.
 */
export async function cancelScheduledTournament(tournamentId: string) {
  const tournament = await getTournament(tournamentId);
  // claim it first, so a start at the same moment can't also happen
  const claimed = await sql(
    `update tournaments set status = 'cancelled' where id = $1 and status = 'scheduled' returning id`,
    [tournamentId],
  );
  if (!claimed.length) throw new Error("Only a tournament that hasn't started can be cancelled");

  const entries = await sql<{ member_id: string }>(
    `delete from tournament_entries where tournament_id = $1 returning member_id`,
    [tournamentId],
  );
  const refund = num(tournament.buy_in) + num(tournament.fee);
  for (const e of entries) {
    if (refund > 0) await sendChips(e.member_id, refund, `mtt_cancel:${tournamentId}`);
  }
  const fees = num(tournament.fee) * entries.length;
  if (fees > 0) {
    await sql(
      `update club_rake set total_rake = greatest(total_rake - $1, 0), updated_at = now() where club_id = $2`,
      [fees, DEFAULT_CLUB_ID],
    );
  }
  return { refunded: entries.length };
}
