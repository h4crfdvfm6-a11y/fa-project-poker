import { sql } from "./db";
import { ensureOnce } from "./schema-once";

/** Tier thresholds, in play points. Purchases never add points. */
export const TIERS = [
  { key: "copper", label: "Copper", minPoints: 0 },
  { key: "silver", label: "Silver", minPoints: 2000 },
  { key: "gold", label: "Gold", minPoints: 5000 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

/** Points for each hand dealt to a real player. */
export const POINTS_PER_HAND = 1;

/** Copper coins paid once when a player first reaches a tier. */
export const TIER_UP_REWARD_COPPER: Record<TierKey, number> = {
  copper: 0,
  silver: 200,
  gold: 500,
};

/** Cash-game stakes and buy-in ranges per tier. Blinds in chips. */
export const CASH_STAKES: Record<
  TierKey,
  { sb: number; bb: number; buyinMin: number; buyinMax: number }
> = {
  copper: { sb: 100, bb: 200, buyinMin: 2000, buyinMax: 10000 },
  silver: { sb: 500, bb: 1000, buyinMin: 20000, buyinMax: 100000 },
  gold: { sb: 2500, bb: 5000, buyinMin: 100000, buyinMax: 500000 },
};

/** Tournament entry: Copper is open to all and paid with free chips. */
export const TOURNAMENT_ENTRY: Record<
  TierKey,
  { entryChips: number; requiresTier: boolean }
> = {
  copper: { entryChips: 0, requiresTier: false },
  silver: { entryChips: 0, requiresTier: true },
  gold: { entryChips: 0, requiresTier: true },
};

export function tierForPoints(points: number): TierKey {
  let tier: TierKey = "copper";
  for (const t of TIERS) {
    if (points >= t.minPoints) tier = t.key;
  }
  return tier;
}

/** True when a player at this many points may use a table or event of the given tier. */
export function canUseTier(points: number, required: TierKey): boolean {
  const order: TierKey[] = ["copper", "silver", "gold"];
  return order.indexOf(tierForPoints(points)) >= order.indexOf(required);
}

export async function ensurePlayPointsSchema() {
  await ensureOnce("play-points-v1", async () => {
    await sql(
      `alter table members add column if not exists play_points integer not null default 0`,
    );
  });
}

/** Add play points to the given players (bots and duplicates are skipped by the caller). */
export async function awardPlayPoints(memberIds: string[], points: number) {
  if (!memberIds.length || points <= 0) return;
  await ensurePlayPointsSchema();
  await sql(
    `update members set play_points = play_points + $2 where id = any($1::text[])`,
    [memberIds, points],
  );
}

export async function getPlayerTier(memberId: string) {
  await ensurePlayPointsSchema();
  const [row] = await sql<{ play_points: number }>(
    `select play_points from members where id = $1`,
    [memberId],
  );
  const points = Number(row?.play_points ?? 0);
  return { points, tier: tierForPoints(points) };
}
