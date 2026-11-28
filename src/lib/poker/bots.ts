import type { Card } from "./cards";
import {
  potLimitMaxTo,
  publicPot,
  type ActionType,
  type EngineSeat,
  type EngineState,
} from "./engine";
import { bestHand, CAT } from "./eval";
import { isAllInOrFold, isPotLimit, type GameType } from "./variants";

/** The five table personalities. Each bot keeps one for the whole session. */
export type BotStyle = "nit" | "calling_station" | "maniac" | "lag" | "passive_fish";

export const BOT_STYLES: BotStyle[] = [
  "nit",
  "calling_station",
  "maniac",
  "lag",
  "passive_fish",
];

export const BOT_STYLE_LABEL: Record<BotStyle, string> = {
  nit: "Nit",
  calling_station: "Calling station",
  maniac: "Maniac",
  lag: "LAG",
  passive_fish: "Passive fish",
};

type Persona = {
  /** base pause before acting, ms (a random extra 0–500 is added) */
  thinkMs: number;
  /** hand strength (0–1) needed to bet when nobody has bet */
  openMin: number;
  /** chance to bet with any hand (bluff) */
  openBluff: number;
  /** strength needed to call a bet */
  callMin: number;
  /** strength needed to raise a bet */
  raiseMin: number;
  /** chance to raise a bet with a weak hand (bluff) */
  bluffRaise: number;
  /** chance to call a bet with a hand below callMin */
  looseCall: number;
  /** facing a bet of half the pot or more, fold below this strength (0 = never) */
  pressureFold: number;
  /** all-in-or-fold: shove at this strength, or at aofLoose chance otherwise */
  aofMin: number;
  aofLoose: number;
};

const PERSONAS: Record<BotStyle, Persona> = {
  // plays only premium hands, raises them, folds to pressure
  nit: {
    thinkMs: 1000,
    openMin: 0.7,
    openBluff: 0.02,
    callMin: 0.62,
    raiseMin: 0.84,
    bluffRaise: 0.02,
    looseCall: 0,
    pressureFold: 0.78,
    aofMin: 0.7,
    aofLoose: 0.02,
  },
  // calls almost every hand, rarely raises, sometimes hits the flop
  calling_station: {
    thinkMs: 600,
    openMin: 0.9,
    openBluff: 0,
    callMin: 0.12,
    raiseMin: 0.93,
    bluffRaise: 0,
    looseCall: 0.9,
    pressureFold: 0,
    aofMin: 0.45,
    aofLoose: 0.25,
  },
  // plays everything, bets and raises all the time, loses a lot
  maniac: {
    thinkMs: 300,
    openMin: 0,
    openBluff: 0.7,
    callMin: 0.05,
    raiseMin: 0.4,
    bluffRaise: 0.5,
    looseCall: 0.85,
    pressureFold: 0,
    aofMin: 0,
    aofLoose: 0.8,
  },
  // loose and aggressive: plays many hands, bets hard when it plays
  lag: {
    thinkMs: 450,
    openMin: 0.4,
    openBluff: 0.2,
    callMin: 0.3,
    raiseMin: 0.6,
    bluffRaise: 0.25,
    looseCall: 0.3,
    pressureFold: 0.45,
    aofMin: 0.4,
    aofLoose: 0.2,
  },
  // calls to see the flop, folds what misses, almost never raises
  passive_fish: {
    thinkMs: 750,
    openMin: 0.8,
    openBluff: 0,
    callMin: 0.36,
    raiseMin: 0.97,
    bluffRaise: 0,
    looseCall: 0.1,
    pressureFold: 0.5,
    aofMin: 0.6,
    aofLoose: 0.05,
  },
};

/** Stable style from member/bot id so the same AI keeps a personality. */
export function styleForBot(memberId: string): BotStyle {
  let h = 0;
  for (let i = 0; i < memberId.length; i++) h = (h * 31 + memberId.charCodeAt(i)) >>> 0;
  return BOT_STYLES[h % BOT_STYLES.length]!;
}

export function botThinkMs(style: BotStyle): number {
  return PERSONAS[style].thinkMs + Math.floor(Math.random() * 500);
}

/** Preflop hand strength, 0–0.95, from the two hole cards (or the top cards in Omaha). */
function preflopStrength(hole: Card[]): number {
  const ranks = hole.map((c) => c.r).sort((a, b) => b - a);
  if (hole.length === 2) {
    const hi = ranks[0]!;
    const lo = ranks[1]!;
    if (hi === lo) return clamp(0.5 + ((hi - 2) / 12) * 0.45);
    let v = ((hi + lo) / 28) * 0.6;
    if (hole[0]!.s === hole[1]!.s) v += 0.06;
    const gap = hi - lo;
    if (gap <= 2) v += 0.04 - gap * 0.01;
    return clamp(v);
  }
  // Omaha-style hands: top two cards, a pair in hand, and how many broadway cards
  const pair = new Set(ranks).size < ranks.length;
  const broadway = ranks.filter((r) => r >= 10).length;
  let v = ((ranks[0]! + ranks[1]!) / 28) * 0.55;
  if (pair) v += 0.06;
  if (broadway >= 3) v += 0.08;
  return clamp(v);
}

/** Extra chance to improve on the next cards: flush draw and straight draw. */
function drawBonus(seat: EngineSeat, state: EngineState): number {
  if (state.board.length >= 5) return 0;
  const all = [...seat.hole, ...state.board];
  let bonus = 0;
  for (const suit of new Set(all.map((c) => c.s))) {
    const count = all.filter((c) => c.s === suit).length;
    if (count === 4 && seat.hole.some((c) => c.s === suit)) bonus += 0.2;
  }
  const ranks = new Set(all.map((c) => c.r));
  const holeRanks = new Set(seat.hole.map((c) => c.r));
  if (ranks.has(14)) ranks.add(1);
  if (holeRanks.has(14)) holeRanks.add(1);
  for (let lo = 1; lo <= 10; lo++) {
    let count = 0;
    let fromHand = false;
    for (let r = lo; r < lo + 5; r++) {
      if (ranks.has(r)) count++;
      if (holeRanks.has(r)) fromHand = true;
    }
    if (count === 4 && fromHand) {
      bonus += 0.12;
      break;
    }
  }
  return Math.min(bonus, 0.3);
}

/** Postflop hand strength, 0–0.95, from the best made hand plus draws. */
function postflopStrength(seat: EngineSeat, state: EngineState): number {
  const { score } = bestHand(seat.hole, state.board, state.gameType);
  const cat = score[0] ?? -1;
  const topBoard = state.board.reduce((m, c) => Math.max(m, c.r), 0);
  let v: number;
  if (cat < 0) v = 0.1;
  else if (cat >= CAT.straight) v = 0.93;
  else if (cat === CAT.trips) v = 0.8;
  else if (cat === CAT.twoPair) v = 0.7;
  else if (cat === CAT.pair) v = (score[1] ?? 0) >= topBoard ? 0.58 : 0.4;
  else v = 0.18;
  if (cat <= CAT.pair) v += drawBonus(seat, state);
  return clamp(v);
}

function strengthOf(seat: EngineSeat, state: EngineState): number {
  return state.board.length === 0
    ? preflopStrength(seat.hole)
    : postflopStrength(seat, state);
}

function clamp(v: number) {
  return Math.max(0, Math.min(0.95, v));
}

type Decision = { type: ActionType; amount?: number };

export function decideBotAction(state: EngineState, seatNo: number): Decision {
  const seat = state.seats.find((s) => s.seat === seatNo)!;
  const persona = PERSONAS[styleForBot(seat.memberId)];
  const strength = strengthOf(seat, state);
  const toCall = Math.max(0, state.currentBet - seat.bet);
  const stackMax = seat.bet + seat.stack;
  const pot = publicPot(state);
  const roll = Math.random;

  /** Bet or raise to `to`; a shove when it reaches the stack; null when the size isn't legal. */
  const sized = (to: number): Decision | null => {
    const minTo = state.currentBet > 0 ? state.currentBet + state.minRaise : state.bb;
    let target = Math.max(to, minTo);
    if (isPotLimit(state.gameType)) {
      target = Math.min(target, potLimitMaxTo(state, seatNo));
    }
    if (target >= stackMax) return { type: "allin", amount: stackMax };
    if (target < minTo) return null;
    return { type: state.currentBet > 0 ? "raise" : "bet", amount: target };
  };

  if (isAllInOrFold(state.gameType)) {
    const shove = strength >= persona.aofMin || roll() < persona.aofLoose;
    return shove ? { type: "allin", amount: stackMax } : { type: "fold" };
  }

  if (state.cucurucho) {
    const stay = strength >= persona.callMin || roll() < persona.looseCall;
    if (!stay) return { type: "fold" };
    if (toCall > 0) {
      return toCall >= seat.stack
        ? { type: "allin", amount: stackMax }
        : { type: "call", amount: seat.bet + toCall };
    }
    return seat.stack > 0 ? { type: "bet", amount: stackMax } : { type: "fold" };
  }

  // Nobody has bet yet: bet with a good hand, or bluff by personality.
  if (toCall === 0) {
    const wantsBet =
      (strength >= persona.openMin && roll() < 0.8) || roll() < persona.openBluff;
    if (wantsBet && seat.stack > state.bb) {
      // preflop: raise the big blind to about 2.5–3.5 BB; postflop: 40–75% pot
      const base =
        state.board.length === 0
          ? state.bb * (2.5 + roll())
          : Math.max(state.bb, Math.round(pot * (0.4 + roll() * 0.35)));
      const decision = sized(state.currentBet + base);
      if (decision) return decision;
    }
    return { type: "check" };
  }

  // Facing a bet: a shove is called only by hands that could call anything.
  if (toCall >= seat.stack) {
    return strength >= persona.callMin || roll() < persona.looseCall
      ? { type: "allin", amount: stackMax }
      : { type: "fold" };
  }

  const potOdds = toCall / (pot + toCall);
  const strong = strength >= persona.raiseMin;
  if (strong ? roll() < 0.6 : roll() < persona.bluffRaise) {
    const decision = sized(
      state.currentBet + Math.max(state.minRaise, Math.round(pot * (0.6 + roll() * 0.4))),
    );
    if (decision) return decision;
  }

  // Folds to pressure: a big bet with a weak hand is folded by the careful styles.
  if (persona.pressureFold > 0 && toCall * 2 >= pot && strength < persona.pressureFold) {
    return { type: "fold" };
  }

  if (strength >= Math.max(persona.callMin, potOdds * 0.8)) {
    return { type: "call", amount: Math.min(toCall, seat.stack) };
  }
  if (roll() < persona.looseCall) {
    return { type: "call", amount: Math.min(toCall, seat.stack) };
  }
  return { type: "fold" };
}
