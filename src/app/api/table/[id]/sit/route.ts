import { chipsOnOtherTable, leaveAllTables, markSeen } from "@/lib/seat-presence";
import { sitAtTable } from "@/lib/table-play";
import { manageTestBots, waitForBetweenHands } from "@/lib/test-bots";
import { isRemoved } from "@/lib/admin-actions";
import { getPlayerId } from "@/lib/session";
import { assertSameOrigin } from "@/lib/csrf";
import { sql } from "@/lib/db";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const { id } = await ctx.params;
  const playerId = await getPlayerId();
  if (!playerId) {
    return Response.json({ error: "Join the club lobby first" }, { status: 401 });
  }
  if (await isRemoved(playerId)) {
    return Response.json({ error: "You are no longer in this club" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    seat?: number;
    buyIn?: number;
  };
  try {
    // one cash table at a time: leaving the others brings those chips back
    // (done first: it can take a few seconds if a hand is running there)
    await leaveAllTables(playerId, id).catch(() => undefined);
    // test mode: wait for the bots' hand to finish, make sure a seat is free
    await waitForBetweenHands(id);
    await manageTestBots(id, playerId).catch(() => undefined);
    // the seat you tapped may have been taken by a bot meanwhile: use a free one
    let seatNo = Number(body.seat ?? 0);
    const seats = await sql<{ seat_no: number; member_id: string | null }>(
      `select seat_no, member_id from table_seats where table_id = $1 order by seat_no`,
      [id],
    );
    if (seats.find((s) => s.seat_no === seatNo)?.member_id) {
      const free = seats.find((s) => !s.member_id);
      if (free) seatNo = free.seat_no;
    }
    const view = await sitAtTable(id, playerId, seatNo, Number(body.buyIn ?? 0));
    await markSeen(id, playerId).catch(() => undefined);
    return Response.json(view);
  } catch (error) {
    let message = error instanceof Error ? error.message : "Failed";
    if (message === "Not enough club chips" && (await chipsOnOtherTable(playerId, id).catch(() => false))) {
      message = "Your chips are still on your other table — they come back as soon as that hand ends. Try again in a moment.";
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
