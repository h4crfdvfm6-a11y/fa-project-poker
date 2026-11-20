import { sql } from "./db";

/**
 * Free Time Bank cards, GG style: each card adds 10 seconds and is used
 * automatically when a player's base time runs out (one card per decision).
 * Everyone starts with 5, earns 1 more every 25 hands played, and holds at
 * most 12. Kept per player across tables.
 */
export const TIME_BANK_START = 5;
export const TIME_BANK_MAX = 12;
export const TIME_BANK_HANDS_PER_CARD = 25;
export const TIME_BANK_CARD_MS = 10_000;

export async function timeBankCards(memberId: string): Promise<number> {
  const [row] = await sql<{ cards: number }>(
    `select cards from member_time_bank where member_id = $1`,
    [memberId],
  );
  return row ? Number(row.cards) : TIME_BANK_START;
}

/** Take one card if the player has any. True when a card was used. */
export async function useTimeBankCard(memberId: string): Promise<boolean> {
  await sql(
    `insert into member_time_bank (member_id, cards) values ($1, $2)
     on conflict (member_id) do nothing`,
    [memberId, TIME_BANK_START],
  );
  const rows = await sql<{ cards: number }>(
    `update member_time_bank set cards = cards - 1, updated_at = now()
     where member_id = $1 and cards > 0
     returning cards`,
    [memberId],
  );
  return rows.length > 0;
}

/** After a hand is dealt: count it for everyone dealt in (1 card per 25 hands). */
export async function countHandPlayed(memberIds: string[]) {
  for (const id of new Set(memberIds)) {
    await sql(
      `insert into member_time_bank (member_id, cards, hands_since)
       values ($1, $2, 1)
       on conflict (member_id) do update set
         cards = case
           when member_time_bank.hands_since + 1 >= $3
             then least($4, member_time_bank.cards + 1)
           else member_time_bank.cards end,
         hands_since = case
           when member_time_bank.hands_since + 1 >= $3 then 0
           else member_time_bank.hands_since + 1 end,
         updated_at = now()`,
      [id, TIME_BANK_START, TIME_BANK_HANDS_PER_CARD, TIME_BANK_MAX],
    );
  }
}
