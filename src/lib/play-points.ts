import { sql, withTransaction } from "./db";
import { id } from "./ids";
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

/** Chips on each daily login. Placeholder amount, to confirm. */
export const DAILY_LOGIN_CHIPS = 1000;

/** Same club id as DEFAULT_CLUB_ID in club.ts, kept here to avoid an import cycle. */
const CLUB_ID = "club_fa_poker";

/**
 * Paid once when a player first reaches a tier: chips plus free
 * tournament tickets for that tier. Copper is for the shop only.
 */
export const TIER_UP_REWARD: Record<
  TierKey,
  { chips: number; freeTickets: number }
> = {
  copper: { chips: 0, freeTickets: 0 },
  silver: { chips: 10000, freeTickets: 1 },
  gold: { chips: 50000, freeTickets: 1 },
};

/** Cash-game stakes and buy-in ranges per tier. Blinds and buy-ins in chips. */
export const CASH_STAKES: Record<
  TierKey,
  { sb: number; bb: number; buyinMin: number; buyinMax: number }
> = {
  copper: { sb: 100, bb: 200, buyinMin: 2000, buyinMax: 10000 },
  silver: { sb: 500, bb: 1000, buyinMin: 20000, buyinMax: 100000 },
  gold: { sb: 2500, bb: 5000, buyinMin: 100000, buyinMax: 500000 },
};

/**
 * Tournament starting stacks at 100 big blinds, per tier.
 * Copper is open to everyone and entered with free chips;
 * Silver and Gold need the matching tier.
 */
export const TOURNAMENT_STAGE: Record<
  TierKey,
  { sb: number; bb: number; startingStack: number; requiresTier: boolean }
> = {
  copper: { sb: 100, bb: 200, startingStack: 20000, requiresTier: false },
  silver: { sb: 500, bb: 1000, startingStack: 100000, requiresTier: true },
  gold: { sb: 2500, bb: 5000, startingStack: 500000, requiresTier: true },
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

export async function ensureRewardsSchema() {
  await ensureOnce("rewards-v1", async () => {
    await sql(
      `create table if not exists member_rewards (
         id text primary key,
         member_id text not null references members(id),
         kind text not null,
         reward_key text not null,
         chips integer not null default 0,
         ticket_tier text not null default '',
         tickets integer not null default 0,
         created_at timestamptz not null default now(),
         collected_at timestamptz,
         unique (member_id, reward_key)
       )`,
    );
    await sql(
      `create table if not exists member_tickets (
         id text primary key,
         member_id text not null references members(id),
         tier text not null,
         source text not null default '',
         created_at timestamptz not null default now(),
         used_at timestamptz
       )`,
    );
  });
}

async function grantTierUp(memberId: string, tier: TierKey) {
  const reward = TIER_UP_REWARD[tier];
  await sql(
    `insert into member_rewards (id, member_id, kind, reward_key, chips, ticket_tier, tickets)
     values ($1,$2,'tier_up',$3,$4,$5,$6)
     on conflict (member_id, reward_key) do nothing`,
    [
      id("rew"),
      memberId,
      `tier:${tier}`,
      reward.chips,
      tier,
      reward.freeTickets,
    ],
  );
}

/** Add play points. Crossing a tier threshold creates that tier's reward once. */
export async function awardPlayPoints(memberIds: string[], points: number) {
  if (!memberIds.length || points <= 0) return;
  await ensurePlayPointsSchema();
  await ensureRewardsSchema();
  const rows = await sql<{ id: string; play_points: number }>(
    `update members set play_points = play_points + $2
     where id = any($1::text[])
     returning id, play_points`,
    [memberIds, points],
  );
  for (const row of rows) {
    const after = Number(row.play_points);
    const before = after - points;
    for (const t of TIERS) {
      if (t.key !== "copper" && t.minPoints > before && t.minPoints <= after) {
        await grantTierUp(row.id, t.key);
      }
    }
  }
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

/** Create today's login reward (UTC day), once per player. */
export async function ensureDailyReward(memberId: string) {
  await ensureRewardsSchema();
  const day = new Date().toISOString().slice(0, 10);
  await sql(
    `insert into member_rewards (id, member_id, kind, reward_key, chips, ticket_tier, tickets)
     values ($1,$2,'daily',$3,$4,'copper',1)
     on conflict (member_id, reward_key) do nothing`,
    [id("rew"), memberId, `daily:${day}`, DAILY_LOGIN_CHIPS],
  );
}

export type PendingReward = {
  id: string;
  kind: string;
  reward_key: string;
  chips: number;
  ticket_tier: string;
  tickets: number;
};

export async function listPendingRewards(memberId: string) {
  await ensureRewardsSchema();
  return sql<PendingReward>(
    `select id, kind, reward_key, chips, ticket_tier, tickets
     from member_rewards
     where member_id = $1 and collected_at is null
     order by created_at asc`,
    [memberId],
  );
}

/** Collect one reward: credit chips and add tickets. Each reward collects once. */
export async function collectReward(memberId: string, rewardId: string) {
  await ensureRewardsSchema();
  await withTransaction(async (q) => {
    const rows = await q<{
      chips: number;
      tickets: number;
      ticket_tier: string;
      reward_key: string;
    }>(
      `update member_rewards set collected_at = now()
       where id = $1 and member_id = $2 and collected_at is null
       returning chips, tickets, ticket_tier, reward_key`,
      [rewardId, memberId],
    );
    if (!rows.length) throw new Error("Reward already collected");
    const r = rows[0]!;
    const chips = Number(r.chips);
    if (chips > 0) {
      await q(
        `update members set chip_balance = chip_balance + $2 where id = $1`,
        [memberId, chips],
      );
      await q(
        `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
         values ($1,$2,$3,$4,$5,'system')`,
        [id("led"), CLUB_ID, memberId, chips, `reward:${r.reward_key}`],
      );
    }
    for (let i = 0; i < Number(r.tickets); i++) {
      await q(
        `insert into member_tickets (id, member_id, tier, source) values ($1,$2,$3,$4)`,
        [id("tkt"), memberId, r.ticket_tier, r.reward_key],
      );
    }
  });
}

/** Unused tickets for one tier. */
export async function countTickets(memberId: string, tier: TierKey) {
  await ensureRewardsSchema();
  const [row] = await sql<{ n: number }>(
    `select count(*)::int as n from member_tickets
     where member_id = $1 and tier = $2 and used_at is null`,
    [memberId, tier],
  );
  return Number(row?.n ?? 0);
}
