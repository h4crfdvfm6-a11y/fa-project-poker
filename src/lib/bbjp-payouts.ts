/**
 * Bad beat jackpot (cash games only): the fixed amount paid for each qualifying losing hand (club chips).
 * The amount is capped at what is in the jackpot pool. The paid amount is then
 * split 50% to the player who lost, 25% to the winner, and 25% to the other players.
 * Any part of the pool not paid stays in the jackpot.
 */

export const BBJP_PAYOUTS = [
  { hand: "royal_flush", label: "Royal flush", amount: 50_000 },
  { hand: "straight_flush", label: "Straight flush", amount: 20_000 },
  { hand: "four_of_a_kind", label: "Four of a kind", amount: 8_000 },
  { hand: "full_house", label: "Full house", amount: 3_000 },
] as const;

export type BbjpPayoutHand = (typeof BBJP_PAYOUTS)[number]["hand"];

/** The hand tier for a hand score (from poker/eval), or null if it has no jackpot tier. */
export function bbjpTierOf(score: number[]): BbjpPayoutHand | null {
  const cat = score[0] ?? -1;
  // straight flush category is 8; an ace-high straight flush is a royal flush
  if (cat === 8) return score[1] === 14 ? "royal_flush" : "straight_flush";
  if (cat === 7) return "four_of_a_kind";
  if (cat === 6) return "full_house";
  return null;
}

/** The fixed amount for a losing hand tier, or 0 if there is no tier. */
export function bbjpPayoutFor(hand: string | null): number {
  return BBJP_PAYOUTS.find((p) => p.hand === hand)?.amount ?? 0;
}

/** What is actually paid: the fixed amount, capped at the pool. */
export function bbjpPaidAmount(pool: number, hand: string | null): number {
  return Math.min(Math.max(0, pool), bbjpPayoutFor(hand));
}
