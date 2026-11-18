import type { EngineSeat, EngineState } from "./engine";
import { isAllInOrFold, isBombPot } from "./variants";

/**
 * Straddles for cash tables, posted right after the blinds.
 *
 * Normal straddles (unlimited, in turn): the player after the big blind may
 * straddle 2× the BB, the next player may re-straddle 2× that, and so on round
 * the table (stops before reaching the blinds again). The chain must be
 * unbroken: the first player who hasn't ticked Straddle ends it.
 *
 * Mississippi straddle: any player except the blinds may straddle 2× the BB
 * from any seat. If several have it ticked, only the one closest to the dealer
 * button (button first, then the cut-off, and so on) gets it. Only one per hand,
 * and it replaces the normal straddles for that hand.
 *
 * In both cases the straddler acts last before the flop; action starts with the
 * player to their left. A player needs enough chips to post the full straddle.
 */
export type StraddleOptions = {
  /** table allows normal straddles */
  straddle: boolean;
  /** table allows the Mississippi straddle */
  mississippi: boolean;
  /** seats that have Straddle ticked */
  straddleSeats: number[];
  /** seats that have Mississippi ticked */
  mississippiSeats: number[];
};

function inThisHand(s: EngineSeat) {
  return !s.sittingOut && s.hole.length > 0;
}

function canAct(s: EngineSeat) {
  return !s.folded && !s.allIn && !s.sittingOut && s.hole.length > 0 && s.stack > 0;
}

function ordered(state: EngineState) {
  return [...state.seats].sort((a, b) => a.seat - b.seat);
}

/** Next seat clockwise after `from` that passes `pred` (same rule as the engine). */
function nextSeat(state: EngineState, from: number, pred: (s: EngineSeat) => boolean) {
  const list = ordered(state);
  if (!list.length) return null;
  const at = list.findIndex((s) => s.seat === from);
  const start = at >= 0 ? (at + 1) % list.length : list.findIndex((s) => s.seat > from);
  const fromIdx = start >= 0 ? start : 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[(fromIdx + i) % list.length]!;
    if (pred(s)) return s.seat;
  }
  return null;
}

/** Seats in this hand, starting at the button and going backwards (button, cut-off, …). */
function fromButtonBackwards(state: EngineState) {
  const list = ordered(state).filter(inThisHand);
  const at = list.findIndex((s) => s.seat === state.button);
  const out: EngineSeat[] = [];
  for (let i = 0; i < list.length; i++) {
    out.push(list[(((at >= 0 ? at : 0) - i) % list.length + list.length) % list.length]!);
  }
  return out;
}

function post(seat: EngineSeat, amount: number) {
  seat.stack -= amount;
  seat.bet += amount;
  seat.contributed += amount;
  if (seat.stack <= 0) {
    seat.stack = 0;
    seat.allIn = true;
  }
}

function log(state: EngineState, msg: string) {
  state.log = [...state.log.slice(-40), msg];
}

/** Apply straddles to a freshly started hand (blinds already posted). */
export function applyStraddles(state: EngineState, opts: StraddleOptions): EngineState {
  if (!opts.straddle && !opts.mississippi) return state;
  if (state.street !== "preflop" || state.board.length || state.cucurucho) return state;
  if (isBombPot(state.gameType) || isAllInOrFold(state.gameType)) return state;
  if (state.toAct == null) return state;

  const players = state.seats.filter(inThisHand);
  if (players.length < 3) return state; // no straddles heads-up

  const sbSeat = nextSeat(state, state.button, inThisHand);
  const bbSeat = sbSeat == null ? null : nextSeat(state, sbSeat, inThisHand);
  if (sbSeat == null || bbSeat == null) return state;
  const isBlind = (seat: number) => seat === sbSeat || seat === bbSeat;
  const straddleAmount = state.bb * 2;

  // Mississippi first: it replaces the normal straddles for this hand.
  if (opts.mississippi && opts.mississippiSeats.length) {
    const wants = new Set(opts.mississippiSeats);
    const pick = fromButtonBackwards(state).find(
      (s) => wants.has(s.seat) && !isBlind(s.seat) && canAct(s) && s.stack >= straddleAmount,
    );
    if (pick) {
      post(pick, straddleAmount);
      state.currentBet = straddleAmount;
      state.minRaise = straddleAmount;
      state.acted = [];
      state.toAct = nextSeat(state, pick.seat, canAct) ?? state.toAct;
      log(state, `${pick.name} posts a Mississippi straddle ${straddleAmount}`);
      return state;
    }
  }

  if (!opts.straddle || !opts.straddleSeats.length) return state;
  const wants = new Set(opts.straddleSeats);
  let last: number = bbSeat;
  let amount = state.bb;
  for (let i = 0; i < players.length; i++) {
    const next = nextSeat(state, last, inThisHand);
    if (next == null || isBlind(next)) break; // went all the way round
    const seat = state.seats.find((s) => s.seat === next)!;
    if (!wants.has(next) || !canAct(seat) || seat.stack < amount * 2) break;
    amount *= 2;
    post(seat, amount);
    log(state, `${seat.name} straddles ${amount}`);
    last = next;
  }
  if (last === bbSeat) return state; // nobody straddled
  state.currentBet = amount;
  state.minRaise = amount;
  state.acted = [];
  state.toAct = nextSeat(state, last, canAct) ?? state.toAct;
  return state;
}
