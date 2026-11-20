import { sql } from "./db";
import type { EngineState } from "./poker/engine";
import { wantsToLeave } from "./seat-presence";
import { legalActions, playerAction } from "./table-play";
import { TIME_BANK_CARD_MS, useTimeBankCard } from "./time-bank";

/**
 * GG-style time to act: 10 s pre-flop, 15 s on the flop, turn and river,
 * 12 s on Spin & Gold. When it runs out, one free Time Bank card (+10 s) is
 * used automatically if the player has one; after that the player is checked
 * if that's free, otherwise folded. Timing out never takes anyone off the seat.
 */
export function baseActionMs(street: string, spin: boolean) {
  if (spin) return 12_000;
  return street === "preflop" ? 10_000 : 15_000;
}

type Clock = {
  state: EngineState;
  idleMs: number;
  /** the decision in progress: same hand, same player, same table write */
  key: string;
  baseMs: number;
  bankMs: number;
};

async function readClock(tableId: string): Promise<Clock | null> {
  const [row] = await sql<{
    state_json: string;
    idle_ms: string | number | null;
    since: string;
    kind: string | null;
    bank_key: string | null;
    bank_ms: number | null;
  }>(
    `select r.state_json,
            extract(epoch from (now() - r.updated_at)) * 1000 as idle_ms,
            r.updated_at::text as since,
            (select t.kind from tournaments t where t.table_id = r.table_id limit 1) as kind,
            c.decision_key as bank_key,
            c.bank_ms
     from table_runtime r
     left join action_clock c on c.table_id = r.table_id
     where r.table_id = $1`,
    [tableId],
  );
  if (!row || !row.state_json || row.state_json === "{}") return null;
  const state = JSON.parse(row.state_json) as EngineState & { dealRound?: unknown };
  if ("dealRound" in state) return null; // OFC tables have their own flow
  if (state.toAct == null || state.street === "showdown" || state.street === "waiting") return null;
  const key = `${state.handNo}:${state.toAct}:${row.since}`;
  return {
    state,
    idleMs: Number(row.idle_ms ?? 0),
    key,
    baseMs: baseActionMs(state.street, row.kind === "spin"),
    bankMs: row.bank_key === key ? Number(row.bank_ms ?? 0) : 0,
  };
}

/**
 * Keep the table moving when someone walks away or closes the app. Any
 * viewer's poll can trigger it — it depends only on the server clock, and
 * playerAction's versioned write stops double actions.
 */
export async function enforceActionTimeout(tableId: string) {
  const clock = await readClock(tableId);
  if (!clock) return;
  const { state } = clock;
  const actor = state.seats.find((s) => s.seat === state.toAct);
  if (!actor || actor.isBot || !actor.memberId) return;

  // a player who went back to the lobby is acted for straight away
  const leaving = await wantsToLeave(tableId, actor.memberId).catch(() => false);
  if (!leaving) {
    if (clock.idleMs < clock.baseMs + clock.bankMs) return;
    // base time is up: use one free Time Bank card (+10 s) for this decision
    if (clock.bankMs === 0 && (await useTimeBankCard(actor.memberId).catch(() => false))) {
      await sql(
        `insert into action_clock (table_id, decision_key, bank_ms) values ($1, $2, $3)
         on conflict (table_id) do update set decision_key = excluded.decision_key, bank_ms = excluded.bank_ms`,
        [tableId, clock.key, TIME_BANK_CARD_MS],
      );
      return;
    }
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
 * How long the player to act still has (and the whole time for this decision,
 * base + any Time Bank card), so the table can draw the countdown ring around
 * their name box. Measured on the server, so the phone's own clock doesn't matter.
 */
export async function actionClock(
  tableId: string,
): Promise<{ msLeft: number; totalMs: number; timeBank: boolean } | null> {
  const clock = await readClock(tableId);
  if (!clock) return null;
  const totalMs = clock.baseMs + clock.bankMs;
  return {
    msLeft: Math.max(0, totalMs - clock.idleMs),
    totalMs,
    timeBank: clock.bankMs > 0,
  };
}
