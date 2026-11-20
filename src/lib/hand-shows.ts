import { sql } from "./db";
import { serializeCards, type EngineState } from "./poker/engine";

/**
 * After a hand, a player can choose which of their cards to show the table
 * (one card, two, or all). The choice is kept per table + hand number and is
 * shown to everyone until the next hand is dealt.
 */

let ready: Promise<void> | null = null;
function ensureShowsSchema() {
  ready ??= (async () => {
    await sql(
      `create table if not exists hand_shows (
         table_id text not null,
         member_id text not null,
         hand_no integer not null,
         seat_no integer not null,
         cards text not null default '',
         primary key (table_id, member_id)
       )`,
    );
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function readState(tableId: string) {
  const [row] = await sql<{ state_json: string }>(
    `select state_json from table_runtime where table_id = $1`,
    [tableId],
  );
  if (!row?.state_json || row.state_json === "{}") return null;
  const state = JSON.parse(row.state_json) as EngineState & { dealRound?: unknown };
  if ("dealRound" in state) return null; // OFC has its own showdown
  return state;
}

/**
 * Pick the cards to show (any time during the hand; others only see them once
 * the hand has finished). `cards` replaces any earlier choice.
 */
export async function setShownCards(
  tableId: string,
  memberId: string,
  cards: string[],
  handNo?: number,
) {
  await ensureShowsSchema();
  const state = await readState(tableId);
  if (!state) throw new Error("No hand to show");
  // the tap was for the hand that just ended, but the next one is already dealt
  if (handNo != null && state.handNo !== handNo) {
    throw new Error("Too late to show — the next hand has started");
  }
  const seat = state.seats.find((s) => s.memberId === memberId);
  if (!seat || !seat.hole.length) throw new Error("You have no cards this hand");
  // you can choose during the hand too; the cards are only shown once it ends
  const mine = serializeCards(seat.hole);
  const pick = [...new Set(cards)].filter((c) => mine.includes(c));
  await sql(
    `insert into hand_shows (table_id, member_id, hand_no, seat_no, cards)
     values ($1, $2, $3, $4, $5)
     on conflict (table_id, member_id)
     do update set hand_no = excluded.hand_no, seat_no = excluded.seat_no, cards = excluded.cards`,
    [tableId, memberId, state.handNo, seat.seat, pick.join(",")],
  );
  return pick;
}

type ViewHand = {
  handNo: number;
  street: string;
  seats: Array<{ seat: number; hole: string[]; shown?: string[] }>;
} | null;

/**
 * Put the cards players chose to show into the table view. They appear for
 * everyone once the hand has finished (a folded player's choice waits for the
 * end of the hand too, so it never gives information away mid-hand).
 */
export async function applyShownCards(tableId: string, hand: ViewHand, mySeat: number | null) {
  if (!hand || !hand.seats?.length) return;
  await ensureShowsSchema();
  const rows = await sql<{ seat_no: number; cards: string }>(
    `select seat_no, cards from hand_shows where table_id = $1 and hand_no = $2 and cards <> ''`,
    [tableId, hand.handNo],
  );
  const picks = new Map(rows.map((r) => [r.seat_no, r.cards.split(",").filter(Boolean)]));
  // your own choice is marked on your cards (others never see it mid-hand)
  const mine = mySeat != null ? hand.seats.find((x) => x.seat === mySeat) : undefined;
  if (mine) mine.shown = picks.get(mySeat!) ?? [];
  if (hand.street !== "showdown") return;
  const state = await readState(tableId);
  if (!state || state.handNo !== hand.handNo) return;

  // everyone folded to one player: that winner's cards stay hidden unless chosen
  const live = state.seats.filter((x) => !x.folded && x.hole.length > 0);
  if (live.length === 1 && live[0]!.seat !== mySeat) {
    const s = hand.seats.find((x) => x.seat === live[0]!.seat);
    if (s) s.hole = s.hole.map(() => "xx");
  }

  for (const [seatNo, picked] of picks) {
    if (seatNo === mySeat) continue;
    const s = hand.seats.find((x) => x.seat === seatNo);
    const real = state.seats.find((x) => x.seat === seatNo);
    if (!s || !real) continue;
    const all = serializeCards(real.hole);
    s.hole = all.map((c, i) => (picked.includes(c) ? c : (s.hole[i] ?? "xx")));
  }
}
