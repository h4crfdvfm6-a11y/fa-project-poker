import { enforceActionTimeout } from "@/lib/action-timeout";
import { getTableView } from "@/lib/table-play";
import { manageTestBots, TEST_BOTS } from "@/lib/test-bots";
import { getPlayerId, isAdmin } from "@/lib/session";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const playerId = await getPlayerId();
    const admin = await isAdmin();
    // a player who walked away is checked/folded after 30 seconds
    await enforceActionTimeout(id).catch(() => undefined);
    // test mode: bots keep the table full and free a seat for anyone joining
    await manageTestBots(id, playerId).catch(() => undefined);
    const view = await getTableView(id, playerId, {
      advance: admin || (TEST_BOTS && Boolean(playerId)),
    });
    return Response.json({ ...view, botFill: TEST_BOTS });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
