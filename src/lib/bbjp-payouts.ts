/**
 * Bad beat jackpot: the fixed amount paid for each qualifying losing hand (club chips).
 * The amount is capped at what is in the jackpot pool. The paid amount is then
 * split 50% to the player who lost, 25% to the winner, and 25% to the other players.
 */

export const BBJP_PAYOUTS = [
  { hand: "royal_flush", label: "Royal flush", amount: 50_000 },
  { hand: "straight_flush", label: "Straight flush", amount: 20_000 },
  { hand: "four_of_a_kind", label: "Four of a kind", amount: 8_000 },
  { hand: "full_house", label: "Full house", amount: 3_000 },
] as const;

export type BbjpPayoutHand = (typeof BBJP_PAYOUTS)[number]["hand"];

/** The fixed amount for a losing hand, or 0 if that hand does not qualify. */
export function bbjpPayoutFor(hand: string): number {
  return BBJP_PAYOUTS.find((p) => p.hand === hand)?.amount ?? 0;
}

/** What is actually paid: the fixed amount, capped at the pool. */
export function bbjpPaidAmount(pool: number, hand: string): number {
  return Math.min(Math.max(0, pool), bbjpPayoutFor(hand));
}
