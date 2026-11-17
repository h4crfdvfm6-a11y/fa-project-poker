import { sitAtTable } from "@/lib/table-play";
import { manageTestBots, waitForBetweenHands } from "@/lib/test-bots";
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
  const body = (await request.json().catch(() => ({}))) as {
    seat?: number;
    buyIn?: number;
  };
  try {
    // test mode: wait for the bots' hand to finish, make sure a seat is free
    await waitForBetweenHands(id);
    await manageTestBots(id, playerId).catch(() => undefined);
    const view = await sitAtTable(
      id,
      playerId,
      Number(body.seat ?? 0),
      Number(body.buyIn ?? 0),
    );
    return Response.json(view);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
