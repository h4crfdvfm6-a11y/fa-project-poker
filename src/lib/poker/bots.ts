import type { ActionType, EngineState } from "./engine";
import { isAllInOrFold } from "./variants";

export type BotStyle =
  | "tight"
  | "aggressive"
  | "recreational"
  | "tricky"
  | "beginner"
  | "strong";

const STYLES: BotStyle[] = [
  "tight",
  "aggressive",
  "recreational",
  "tricky",
  "beginner",
  "strong",
];

/** Stable style from member/bot id so the same AI keeps a personality. */
export function styleForBot(memberId: string): BotStyle {
  let h = 0;
  for (let i = 0; i < memberId.length; i++) h = (h * 31 + memberId.charCodeAt(i)) >>> 0;
  return STYLES[h % STYLES.length]!;
}

export function botThinkMs(style: BotStyle): number {
  const base =
    style === "beginner" ? 900 : style === "strong" ? 650 : style === "aggressive" ? 400 : 550;
  return base + Math.floor(Math.random() * 500);
}

export function decideBotAction(
  state: EngineState,
  seatNo: number,
): { type: ActionType; amount?: number } {
  const seat = state.seats.find((s) => s.seat === seatNo)!;
  const style = styleForBot(seat.memberId);
  const toCall = Math.max(0, state.currentBet - seat.bet);
  const stackMax = seat.bet + seat.stack;
  /**
   * Put chips in when nobody has bet yet. Before the flop the big blind (or a
   * straddler) already has the current bet in, so that's a raise, not a bet —
   * the engine refuses a "bet" there ("Use raise").
   */
  const open = (to: number): { type: ActionType; amount?: number } => {
    if (state.currentBet <= 0) return { type: "bet", amount: Math.min(stackMax, to) };
    const raiseTo = Math.max(to, state.currentBet + state.minRaise);
    return raiseTo >= stackMax
      ? { type: "allin", amount: stackMax }
      : { type: "raise", amount: raiseTo };
  };

  if (isAllInOrFold(state.gameType)) {
    const shoveChance =
      style === "aggressive" ? 0.55 : style === "tight" ? 0.28 : style === "beginner" ? 0.4 : 0.42;
    return Math.random() < shoveChance
      ? { type: "allin", amount: stackMax }
      : { type: "fold" };
  }

  if (state.cucurucho) {
    const potChance =
      style === "aggressive" ? 0.55 : style === "tight" ? 0.28 : style === "beginner" ? 0.4 : 0.42;
    if (Math.random() >= potChance) return { type: "fold" };
    if (toCall > 0) {
      return toCall >= seat.stack
        ? { type: "allin", amount: stackMax }
        : { type: "call", amount: seat.bet + toCall };
    }
    return seat.stack > 0 ? open(stackMax) : { type: "fold" };
  }

  if (toCall === 0) {
    if (style === "aggressive" && Math.random() < 0.35 && seat.stack > state.bb) {
      return open(seat.bet + state.bb * (style === "aggressive" ? 3 : 2));
    }
    if (style === "tricky" && Math.random() < 0.2 && seat.stack > state.bb * 2) {
      return open(seat.bet + state.bb * 2.5);
    }
    return { type: "check" };
  }

  const callOk =
    style === "tight"
      ? toCall <= state.bb * 1.5
      : style === "aggressive"
        ? toCall <= state.bb * 5
        : style === "beginner"
          ? toCall <= state.bb * 4
          : style === "strong"
            ? toCall <= state.bb * 3
            : toCall <= state.bb * 2.5;

  if (toCall >= seat.stack) return { type: "allin", amount: stackMax };

  if (style === "aggressive" && Math.random() < 0.25 && seat.stack > toCall + state.bb) {
    const raiseTo = Math.min(stackMax, state.currentBet + state.minRaise * 2);
    if (raiseTo > state.currentBet) return { type: "raise", amount: raiseTo };
  }

  if (callOk || (style === "recreational" && Math.random() < 0.35)) {
    return { type: "call", amount: Math.min(toCall, seat.stack) };
  }

  if (style === "beginner" && Math.random() < 0.2) {
    return { type: "call", amount: Math.min(toCall, seat.stack) };
  }

  return { type: "fold" };
}
