import { actionMsLeft, enforceActionTimeout } from "@/lib/action-timeout";
import { applyShownCards } from "@/lib/hand-shows";
import { markSeen, processPendingLeaves } from "@/lib/seat-presence";
import { straddleView } from "@/lib/straddle-settings";
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
    // the viewer is here; players who went to the lobby or away are taken off
    if (playerId) await markSeen(id, playerId).catch(() => undefined);
    // a player who walked away is checked/folded after 30 seconds
    await enforceActionTimeout(id).catch(() => undefined);
    await processPendingLeaves(id).catch(() => undefined);
    // test mode: bots keep the table full and free a seat for anyone joining
    await manageTestBots(id, playerId).catch(() => undefined);
    const view = await getTableView(id, playerId, {
      advance: admin || (TEST_BOTS && Boolean(playerId)),
    });
    // cards players chose to show after the hand
    await applyShownCards(id, view.hand as Parameters<typeof applyShownCards>[1], view.meSeat).catch(
      () => undefined,
    );
    // time left for the player to act (drives the ring around their name box)
    const msLeft = await actionMsLeft(id).catch(() => null);
    // straddle settings for this table and your ticks
    const straddle = await straddleView(id, playerId).catch(() => null);
    return Response.json({ ...view, botFill: TEST_BOTS, actionMsLeft: msLeft, straddle });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
