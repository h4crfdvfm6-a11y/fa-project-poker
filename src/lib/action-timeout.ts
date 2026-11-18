import { sql } from "./db";
import type { EngineState } from "./poker/engine";
import { wantsToLeave } from "./seat-presence";
import { legalActions, playerAction } from "./table-play";

/** A player who doesn't act within this time is checked (if free) or folded. */
export const ACTION_TIMEOUT_MS = 30_000;

/**
 * Keep the table moving when someone walks away or closes the app: if the
 * player to act hasn't acted for ACTION_TIMEOUT_MS, check for them when that's
 * free, otherwise fold. Any viewer's poll can trigger it — it depends only on
 * the clock, and playerAction's versioned write stops double actions.
 */
export async function enforceActionTimeout(tableId: string) {
  const [row] = await sql<{ state_json: string; idle_ms: string | number | null }>(
    `select state_json, extract(epoch from (now() - updated_at)) * 1000 as idle_ms
     from table_runtime where table_id = $1`,
    [tableId],
  );
  if (!row || !row.state_json || row.state_json === "{}") return;

  const state = JSON.parse(row.state_json) as EngineState & { dealRound?: unknown };
  if ("dealRound" in state) return; // OFC tables have their own flow
  if (state.toAct == null || state.street === "showdown" || state.street === "waiting") return;
  const actor = state.seats.find((s) => s.seat === state.toAct);
  if (!actor || actor.isBot || !actor.memberId) return;
  // a player who went back to the lobby is acted for straight away
  if (
    Number(row.idle_ms ?? 0) < ACTION_TIMEOUT_MS &&
    !(await wantsToLeave(tableId, actor.memberId).catch(() => false))
  ) {
    return;
  }

  const legal = legalActions(state, actor.seat);
  const type = legal.actions.some((a) => a.type === "check") ? "check" : "fold";
  try {
    await playerAction(tableId, actor.memberId, type);
  } catch {
    // someone else acted first — nothing to do
  }
}

/**
 * How long the player to act still has before the timer acts for them, so the
 * table can draw the countdown ring around their name box. Measured on the
 * server, so the phone's own clock doesn't matter.
 */
export async function actionMsLeft(tableId: string): Promise<number | null> {
  const [row] = await sql<{ idle_ms: string | number | null }>(
    `select extract(epoch from (now() - updated_at)) * 1000 as idle_ms
     from table_runtime where table_id = $1`,
    [tableId],
  );
  if (!row) return null;
  return Math.max(0, ACTION_TIMEOUT_MS - Number(row.idle_ms ?? 0));
}
