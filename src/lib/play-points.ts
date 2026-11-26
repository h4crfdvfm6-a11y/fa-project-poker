import { sql } from "./db";
import { ensureOnce } from "./schema-once";

/** Tier thresholds, in play points. Purchases never add points. */
export const TIERS = [
  { key: "copper", label: "Copper", minPoints: 0 },
  { key: "silver", label: "Silver", minPoints: 5000 },
  { key: "gold", label: "Gold", minPoints: 10000 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

/** Points for each hand dealt to a real player. */
export const POINTS_PER_HAND = 1;

export function tierForPoints(points: number): TierKey {
  let tier: TierKey = "copper";
  for (const t of TIERS) {
    if (points >= t.minPoints) tier = t.key;
  }
  return tier;
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
