import { chipsOnOtherTable, leaveAllTables, markSeen } from "@/lib/seat-presence";
import { sitAtTable } from "@/lib/table-play";
import { manageTestBots, waitForBetweenHands } from "@/lib/test-bots";
import { isRemoved } from "@/lib/admin-actions";
import { getPlayerId } from "@/lib/session";
import { assertSameOrigin } from "@/lib/csrf";

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
    // test mode: wait for the bots' hand to finish, make sure a seat is free
    await waitForBetweenHands(id);
    await manageTestBots(id, playerId).catch(() => undefined);
    // one cash table at a time: leaving the others brings those chips back
    await leaveAllTables(playerId, id).catch(() => undefined);
    const view = await sitAtTable(
      id,
      playerId,
      Number(body.seat ?? 0),
      Number(body.buyIn ?? 0),
    );
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
