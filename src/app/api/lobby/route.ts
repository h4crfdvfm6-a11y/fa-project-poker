import {
  getBbjp,
  getOverview,
  listMyTournamentIds,
  listPublicTables,
  listTournaments,
} from "@/lib/club";
import { getPlayerId } from "@/lib/session";
import { sql } from "@/lib/db";
import { after } from "next/server";
import { leaveAllTablesQuick } from "@/lib/seat-presence";

export async function GET() {
  const overview = await getOverview();
  const tables = (await listPublicTables()).filter((t) => t.status === "open");
  const tournaments = (await listTournaments()).filter((t) =>
    ["scheduled", "running"].includes(t.status),
  );
  const bbjp = await getBbjp();
  const playerId = await getPlayerId();
  let me = null;
  let myTournamentIds: string[] = [];
  let leaving = 0;
  if (playerId) {
    const rows = await sql(
      "select id, display_name, chip_balance, role, status from members where id = $1",
      [playerId],
    );
    // a player the admin removed is treated as not in the club
    me = rows[0] && rows[0].status !== "removed" ? rows[0] : null;
    // back in the lobby = off any cash table; chips go back to the balance.
    // A hand still running is finished in the background, so the lobby opens at once.
    leaving = await leaveAllTablesQuick(playerId, (task) =>
      after(() => task().catch(() => undefined)),
    ).catch(() => 0);
    const fresh = await sql("select chip_balance from members where id = $1", [playerId]);
    if (me && fresh[0]) me = { ...me, chip_balance: fresh[0].chip_balance };
    myTournamentIds = await listMyTournamentIds(playerId);
  }
  return Response.json({
    club: {
      name: overview.club.name,
      // Invite is typed by the player — do not publish it on the anonymous lobby.
    },
    tables,
    tournaments,
    bbjp: {
      balance: bbjp.balance,
      enabled: bbjp.enabled,
      trigger_hand: bbjp.trigger_hand,
      cycle_collections: bbjp.cycle_collections,
      minimum_hand: bbjp.minimum_hand,
    },
    me,
    myTournamentIds,
    leaving,
  });
}
