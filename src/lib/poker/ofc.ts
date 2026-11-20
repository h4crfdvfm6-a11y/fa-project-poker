import { Card, cardId, freshDeck, shuffle } from "./cards";
import {
  cmpScore,
  evaluateFive,
  evaluateThree,
  handName,
  type HandScore,
} from "./eval";

export type OfcRow = "front" | "middle" | "back";

export type OfcSeat = {
  seat: number;
  memberId: string;
  name: string;
  stack: number;
  isBot: boolean;
  front: Card[];
  middle: Card[];
  back: Card[];
  /** This hand is Fantasyland, with the deal size carried from qualification. */
  inFantasy: boolean;
  fantasyCards?: number;
  nextFantasyCards?: number;
  /** This board qualifies for Fantasyland on the next hand. */
  fantasyNext: boolean;
  fouled: boolean;
};

export type OfcResult = {
  deltas: Record<string, number>;
  rows: Array<{
    memberId: string;
    front: string;
    middle: string;
    back: string;
    fouled: boolean;
    fantasyNext: boolean;
  }>;
};

export type OfcState = {
  handNo: number;
  street: "setting" | "showdown" | "waiting";
  deck: Card[];
  jokerUltimate?: boolean;
  seats: OfcSeat[];
  button: number;
  toAct: number | null;
  /** Turn sequence within the hand, including the opening sets. */
  dealRound: number;
  draft: Card[];
  unit: number;
  log: string[];
  result: OfcResult | null;
  endedAt: number | null;
};

export type OfcPlacement = { cardIndex: number; row: OfcRow };

function rowCapacity(row: OfcRow) {
  return row === "front" ? 3 : 5;
}

function setCount(s: OfcSeat) {
  return s.front.length + s.middle.length + s.back.length;
}

function pushLog(state: OfcState, msg: string) {
  state.log = [...state.log.slice(-40), msg];
}

function nextOfcSeat(state: OfcState, from: number) {
  const ordered = [...state.seats].sort((a, b) => a.seat - b.seat);
  const at = ordered.findIndex((s) => s.seat === from);
  const start = at >= 0 ? (at + 1) % ordered.length : 0;
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[(start + i) % ordered.length]!;
    if (setCount(s) < 13) return s.seat;
  }
  return null;
}

export function startOfcHand(
  seatsIn: Array<{
    seat: number;
    memberId: string;
    name: string;
    stack: number;
    isBot?: boolean;
    fantasy?: boolean | number;
  }>,
  opts: { handNo: number; button: number; unit: number; jokerUltimate?: boolean },
): OfcState {
  const seats: OfcSeat[] = seatsIn
    .filter((s) => s.stack > 0)
    .map((s) => ({
      seat: s.seat,
      memberId: s.memberId,
      name: s.name,
      stack: s.stack,
      isBot: Boolean(s.isBot),
      front: [],
      middle: [],
      back: [],
      inFantasy: Boolean(s.fantasy),
      fantasyCards: typeof s.fantasy === "number" ? s.fantasy : 14,
      fantasyNext: false,
      fouled: false,
    }));

  const state: OfcState = {
    handNo: opts.handNo,
    street: "setting",
    deck: shuffle(opts.jokerUltimate ? [...freshDeck(), { r: 15, s: 0 }, { r: 15, s: 1 }] : freshDeck()),
    jokerUltimate: opts.jokerUltimate,
    seats,
    button: opts.button,
    toAct: null,
    dealRound: 0,
    draft: [],
    unit: Math.max(1, opts.unit),
    log: [],
    result: null,
    endedAt: null,
  };

  if (seats.length < 2) {
    state.street = "waiting";
    return state;
  }

  const first = nextOfcSeat(state, opts.button) ?? seats[0]!.seat;
  const firstSeat = seats.find((s) => s.seat === first)!;
  const dealN = firstSeat.inFantasy ? firstSeat.fantasyCards ?? 14 : 5;
  dealDraft(state, first, dealN);
  pushLog(
    state,
    `OFC hand #${opts.handNo} · ${firstSeat.inFantasy ? `Fantasyland ${dealN}` : "set 5"}`,
  );
  return state;
}

function dealDraft(state: OfcState, seatNo: number, n: number) {
  state.toAct = seatNo;
  state.draft = [];
  for (let i = 0; i < n; i++) {
    const c = state.deck.pop();
    if (!c) break;
    state.draft.push(c);
  }
}

function placeCards(
  seat: OfcSeat,
  draft: Card[],
  placements: OfcPlacement[],
) {
  const used = new Set<number>();
  const counts = { front: seat.front.length, middle: seat.middle.length, back: seat.back.length };
  for (const p of placements) {
    if (used.has(p.cardIndex)) throw new Error("Duplicate card");
    if (!Number.isInteger(p.cardIndex) || p.cardIndex < 0 || p.cardIndex >= draft.length) {
      throw new Error("Bad card index");
    }
    used.add(p.cardIndex);
    if (p.row !== "front" && p.row !== "middle" && p.row !== "back") {
      throw new Error("Invalid OFC row");
    }
    if (++counts[p.row] > rowCapacity(p.row)) {
      throw new Error(`${p.row} is full`);
    }
  }
  for (const p of placements) seat[p.row].push(draft[p.cardIndex]!);
}

export function applyOfcSet(
  state: OfcState,
  seatNo: number,
  placements: OfcPlacement[],
  discardIndex: number | number[] | null = null,
): OfcState {
  if (state.street !== "setting") throw new Error("Not setting");
  if (state.toAct !== seatNo) throw new Error("Not your turn");
  const seat = state.seats.find((s) => s.seat === seatNo);
  if (!seat) throw new Error("Seat not found");

  const draft = state.draft;
  const fantasyDeal = draft.length >= 14 && draft.length <= 17;
  const required = fantasyDeal ? 13 : draft.length === 5 ? 5 : draft.length === 3 ? 2 : 0;
  if (!required) throw new Error("Nothing to set");
  const discards = discardIndex === null ? [] : Array.isArray(discardIndex) ? discardIndex : [discardIndex];
  if (placements.length !== required || discards.length !== draft.length - required) {
    throw new Error(`Place ${required}, discard ${draft.length - required}`);
  }
  if (new Set(discards).size !== discards.length || discards.some(
    (index) => !Number.isInteger(index) || index < 0 || index >= draft.length ||
      placements.some((placement) => placement.cardIndex === index),
  )) throw new Error("Invalid OFC discard");
  placeCards(seat, draft, placements);

  state.draft = [];
  pushLog(
    state,
    `${seat.name} sets · F${seat.front.length}/M${seat.middle.length}/B${seat.back.length}`,
  );

  if (state.seats.every((s) => setCount(s) >= 13)) {
    finishOfc(state);
    return state;
  }

  const next = nextOfcSeat(state, seatNo);
  if (next == null) {
    finishOfc(state);
    return state;
  }
  state.dealRound += 1;
  const nextSeat = state.seats.find((s) => s.seat === next)!;
  const dealN =
    setCount(nextSeat) === 0 ? (nextSeat.inFantasy ? nextSeat.fantasyCards ?? 14 : 5) : 3;
  dealDraft(state, next, dealN);
  return state;
}

function scoreFrontRoyalties(score: HandScore): number {
  const cat = score[0] ?? 0;
  if (cat >= 3) return 10 + Math.max(0, (score[1] ?? 0) - 2); // trips 222=10 … AAA=22
  if (cat === 1) {
    const pair = score[1] ?? 0;
    if (pair < 6) return 0;
    return pair - 5; // 66=1 … AA=9
  }
  return 0;
}

function scoreFiveRoyalties(score: HandScore, middle: boolean): number {
  const cat = score[0] ?? 0;
  const high = score[1] ?? 0;
  // Royal flush (A-high SF) pays more than a normal straight flush.
  if (cat === 8 && high === 14) return middle ? 50 : 25;
  const table: Record<number, number> = middle
    ? { 3: 2, 4: 4, 5: 8, 6: 12, 7: 20, 8: 30 }
    : { 4: 2, 5: 4, 6: 6, 7: 10, 8: 15 };
  return table[cat] ?? 0;
}

type BoardScores = { front: HandScore; middle: HandScore; back: HandScore };

function inOrder({ front, middle, back }: BoardScores) {
  return cmpScore(back, middle) >= 0 && cmpScore(middle, front) >= 0;
}

function royalties({ front, middle, back }: BoardScores) {
  return scoreFrontRoyalties(front) + scoreFiveRoyalties(middle, true) + scoreFiveRoyalties(back, false);
}

function scoreBoard(seat: OfcSeat): BoardScores | null {
  if (seat.front.length !== 3 || seat.middle.length !== 5 || seat.back.length !== 5) return null;
  const cards = [...seat.front, ...seat.middle, ...seat.back];
  const wilds = cards.flatMap((card, index) => card.r === 15 ? [index] : []);
  const score = (): BoardScores => ({
    front: evaluateThree(cards.slice(0, 3)),
    middle: evaluateFive(cards.slice(3, 8)),
    back: evaluateFive(cards.slice(8)),
  });
  if (!wilds.length) return score();
  // Choose distinct substitutes that keep the board valid, then maximize royalties.
  const natural = new Set(cards.filter((card) => card.r !== 15).map(cardId));
  const candidates = freshDeck().filter((card) => !natural.has(cardId(card)));
  let best: BoardScores | null = null;

  function tryWild(depth: number, previous?: Card) {
    const index = wilds[depth];
    if (index !== undefined) {
      for (const card of candidates) {
        if (card === previous) continue;
        cards[index] = card;
        tryWild(depth + 1, card);
      }
      return;
    }
    const next = score();
    if (!inOrder(next)) return;
    const improvement = best && (
      royalties(next) - royalties(best) ||
      cmpScore(next.back, best.back) ||
      cmpScore(next.middle, best.middle) ||
      cmpScore(next.front, best.front)
    );
    if (improvement === null || improvement > 0) best = next;
  }

  tryWild(0);
  return best;
}

function nextFantasySize(seat: OfcSeat, score: BoardScores, ultimate: boolean) {
  const [category, rank] = score.front;
  if (seat.inFantasy) {
    const stays = category === 3 || (score.back[0] ?? 0) >= 7;
    return stays ? (ultimate ? seat.fantasyCards ?? 14 : 14) : 0;
  }
  if (category === 3) return ultimate ? 17 : 14;
  if (category === 1 && (rank ?? 0) >= 12) return ultimate ? (rank ?? 14) + 2 : 14;
  return 0;
}

export function finishOfc(state: OfcState) {
  const scores = new Map(state.seats.map((seat) => [seat, scoreBoard(seat)]));
  for (const seat of state.seats) {
    const score = scores.get(seat);
    seat.fouled = !score || !inOrder(score);
    seat.nextFantasyCards = score && !seat.fouled ? nextFantasySize(seat, score, Boolean(state.jokerUltimate)) : 0;
    seat.fantasyNext = seat.nextFantasyCards > 0;
  }

  const deltas: Record<string, number> = {};
  for (const s of state.seats) deltas[s.memberId] = 0;

  const n = state.seats.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = state.seats[i]!;
      const b = state.seats[j]!;
      let pts = 0; // points a wins from b
      if (a.fouled && b.fouled) {
        pts = 0;
      } else if (a.fouled) {
        pts = -6 - royalties(scores.get(b)!);
      } else if (b.fouled) {
        pts = 6 + royalties(scores.get(a)!);
      } else {
        const { front: af, middle: am, back: ab } = scores.get(a)!;
        const { front: bf, middle: bm, back: bb } = scores.get(b)!;
        let wins = 0;
        if (cmpScore(af, bf) > 0) wins += 1;
        else if (cmpScore(af, bf) < 0) wins -= 1;
        if (cmpScore(am, bm) > 0) wins += 1;
        else if (cmpScore(am, bm) < 0) wins -= 1;
        if (cmpScore(ab, bb) > 0) wins += 1;
        else if (cmpScore(ab, bb) < 0) wins -= 1;
        pts = wins;
        if (wins === 3) pts += 3; // scoop
        if (wins === -3) pts -= 3;
        pts +=
          scoreFrontRoyalties(af) -
          scoreFrontRoyalties(bf) +
          scoreFiveRoyalties(am, true) -
          scoreFiveRoyalties(bm, true) +
          scoreFiveRoyalties(ab, false) -
          scoreFiveRoyalties(bb, false);
      }
      // Cap transfer to the paying stack — never mint unbacked chips.
      const want = pts * state.unit;
      if (want > 0) {
        const paid = Math.min(want, b.stack);
        b.stack -= paid;
        a.stack += paid;
        deltas[a.memberId] = (deltas[a.memberId] || 0) + paid;
        deltas[b.memberId] = (deltas[b.memberId] || 0) - paid;
      } else if (want < 0) {
        const paid = Math.min(-want, a.stack);
        a.stack -= paid;
        b.stack += paid;
        deltas[b.memberId] = (deltas[b.memberId] || 0) + paid;
        deltas[a.memberId] = (deltas[a.memberId] || 0) - paid;
      }
    }
  }

  state.result = {
    deltas,
    rows: state.seats.map((s) => ({
      memberId: s.memberId,
      front:
        scores.get(s) ? handName(scores.get(s)!.front) : s.fouled ? "foul" : "incomplete",
      middle:
        scores.get(s) ? handName(scores.get(s)!.middle) : s.fouled ? "foul" : "incomplete",
      back: scores.get(s) ? handName(scores.get(s)!.back) : s.fouled ? "foul" : "incomplete",
      fouled: s.fouled,
      fantasyNext: s.fantasyNext,
    })),
  };
  state.street = "showdown";
  state.toAct = null;
  state.endedAt = Date.now();
  pushLog(state, "OFC showdown");
}

/** Simple bot: fill back → middle → front from strongest ranks. */
export function decideOfcBot(
  state: OfcState,
  seatNo: number,
): { placements: OfcPlacement[]; discardIndex: number | number[] | null } {
  const seat = state.seats.find((s) => s.seat === seatNo)!;
  const draft = state.draft;
  const ranked = draft
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.r - a.c.r);

  if (draft.length >= 14) {
    const discards = ranked.slice(13).map(({ i }) => i);
    const discardIndex = discards.length === 1 ? discards[0]! : discards;
    const keep = ranked.slice(0, 13);
    // Fill back 5, middle 5, front 3 from strongest kept cards.
    const rows: OfcRow[] = [
      "back",
      "back",
      "back",
      "back",
      "back",
      "middle",
      "middle",
      "middle",
      "middle",
      "middle",
      "front",
      "front",
      "front",
    ];
    const placements = keep.map((item, idx) => ({
      cardIndex: item.i,
      row: rows[idx]!,
    }));
    return repairPlacements(seat, draft, placements, discardIndex);
  }

  if (draft.length === 5) {
    const placements: OfcPlacement[] = [];
    const order: OfcRow[] = ["back", "back", "middle", "middle", "front"];
    ranked.forEach((item, idx) => {
      placements.push({ cardIndex: item.i, row: order[idx]! });
    });
    // Fix capacities if front/middle/back already partially filled.
    return repairPlacements(seat, draft, placements, null);
  }

  // Pineapple: keep top 2, discard weakest.
  const discardIndex = ranked[2]!.i;
  const keep = ranked.slice(0, 2);
  const placements: OfcPlacement[] = keep.map((item) => {
    if (seat.back.length < 5) return { cardIndex: item.i, row: "back" as const };
    if (seat.middle.length < 5)
      return { cardIndex: item.i, row: "middle" as const };
    return { cardIndex: item.i, row: "front" as const };
  });
  return repairPlacements(seat, draft, placements, discardIndex);
}

function repairPlacements(
  seat: OfcSeat,
  draft: Card[],
  placements: OfcPlacement[],
  discardIndex: number | number[] | null,
): { placements: OfcPlacement[]; discardIndex: number | number[] | null } {
  const copy = {
    front: [...seat.front],
    middle: [...seat.middle],
    back: [...seat.back],
  };
  const fixed: OfcPlacement[] = [];
  for (const p of placements) {
    let row = p.row;
    if (copy[row].length >= rowCapacity(row)) {
      row =
        copy.back.length < 5
          ? "back"
          : copy.middle.length < 5
            ? "middle"
            : "front";
    }
    copy[row].push(draft[p.cardIndex]!);
    fixed.push({ cardIndex: p.cardIndex, row });
  }
  return { placements: fixed, discardIndex };
}

export function serializeOfcCards(cards: Card[]) {
  return cards.map((card) => card.r === 15 ? `j${card.s}` : cardId(card));
}
