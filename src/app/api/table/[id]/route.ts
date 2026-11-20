import { actionClock, enforceActionTimeout } from "@/lib/action-timeout";
import { applyShownCards } from "@/lib/hand-shows";
import { markSeen, processPendingLeaves } from "@/lib/seat-presence";
import { straddleView } from "@/lib/straddle-settings";
import { getTableView } from "@/lib/table-play";
import { manageTestBots, TEST_BOTS } from "@/lib/test-bots";
import { getPlayerId, isAdmin } from "@/lib/session";
import { timeBankCards } from "@/lib/time-bank";

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
    // a player out of time (10 s / 15 s + a free Time Bank card) is checked or folded
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
    const clock = await actionClock(id).catch(() => null);
    // your free Time Bank cards (+10 s each, used automatically)
    const timeBank = playerId && view.meSeat != null ? await timeBankCards(playerId).catch(() => null) : null;
    // straddle settings for this table and your ticks
    const straddle = await straddleView(id, playerId).catch(() => null);
    return Response.json({
      ...view,
      botFill: TEST_BOTS,
      actionMsLeft: clock?.msLeft ?? null,
      actionTotalMs: clock?.totalMs ?? null,
      timeBankInUse: clock?.timeBank ?? false,
      timeBank,
      straddle,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
