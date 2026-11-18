/**
 * Seat geometry + demo data for the Shark Club table.
 * Positions are percentages of the table box (0–100). The hero (you) always
 * sits bottom-centre; everyone else is spread evenly around the oval.
 */

import "./table-landscape.css";

export type SeatPoint = {
  x: number;
  y: number;
  side: "left" | "right" | "top";
  /** CSS `left` for the seat: on the rail, but never past the edge of the screen */
  left: string;
};

/*
 * Seat spots ON the padded rail of the table in the photo, as % of the table
 * box (table-landscape.css sizes the box from the photo). Laid out like the
 * owner's drawing and mock-up: you at the bottom middle, two seats on the top
 * rail, three down each side rail (upper corner, middle, lower corner).
 */
type Spot = [number, number];
const HERO: Spot = [50, 94.6];
const L_LOW: Spot = [6.5, 85];
const L_MID: Spot = [2.5, 65.5];
const L_UP: Spot = [4, 34.5];
const T_LEFT: Spot = [32, 20];
const T_MID: Spot = [50, 19];
const T_RIGHT: Spot = [68, 20];
const R_UP: Spot = [96, 34.5];
const R_MID: Spot = [97.5, 65.5];
const R_LOW: Spot = [93.5, 85];

/** The other players' spots, clockwise from your left, for each table size. */
const LAYOUTS: Record<number, Spot[]> = {
  2: [T_MID],
  3: [T_LEFT, T_RIGHT],
  4: [L_MID, T_MID, R_MID],
  5: [L_MID, T_LEFT, T_RIGHT, R_MID],
  6: [L_MID, L_UP, T_MID, R_UP, R_MID],
  7: [L_MID, L_UP, T_LEFT, T_RIGHT, R_UP, R_MID],
  8: [L_LOW, L_MID, L_UP, T_MID, R_UP, R_MID, R_LOW],
  9: [L_LOW, L_MID, L_UP, T_LEFT, T_RIGHT, R_UP, R_MID, R_LOW],
};

/**
 * Side seats sit right on the rail; on phones where the rail runs almost to
 * the screen edge they stop just inside it (--seat-min / --seat-max are set in
 * table-landscape.css from the screen and table widths).
 */
function edgeLeft(x: number): string {
  if (x < 20) return `max(${x}%, var(--seat-min))`;
  if (x > 80) return `min(${x}%, var(--seat-max))`;
  return `${x}%`;
}

/** Point for seat `slot` (0 = bottom centre, you) at a table with `count` seats. */
export function seatPoint(slot: number, count: number): SeatPoint {
  const n = Math.min(9, Math.max(2, count));
  const [x, y] = slot === 0 ? HERO : (LAYOUTS[n]![(slot - 1) % (n - 1)] ?? T_MID);
  const side = x < 42 ? "left" : x > 58 ? "right" : "top";
  return { x, y, side, left: edgeLeft(x) };
}

export type BetPoint = {
  left: string;
  top: number;
  /** which side of the bet touches `left`: the seat edge for side seats */
  anchor: "center" | "from-left" | "from-right";
};

/**
 * Where a player's bet (chip + amount) sits: on the felt right next to them —
 * under the name box for the top seats, right beside the name box for the side
 * seats (starting at the box edge, whatever the seat size), and just above
 * your cards for you — so each bet is clearly that player's.
 */
export function betPoint(slot: number, count: number): BetPoint {
  const p = seatPoint(slot, count);
  if (slot === 0) return { left: "50%", top: 76.5, anchor: "center" };
  if (p.y < 30) return { left: p.left, top: p.y + 12.5, anchor: "center" };
  const fromLeft = p.x < 50;
  return {
    left: `calc(${p.left} ${fromLeft ? "+" : "-"} (var(--seat-half) - 1px))`,
    top: p.y + 6,
    anchor: fromLeft ? "from-left" : "from-right",
  };
}

const CHIP_COLORS = ["purple", "black", "green", "blue", "red", "orange"] as const;

/** Turn a pot into up to 6 coloured chip stacks (≤8 chips each). */
export function potStacks(pot: number, bb: number) {
  if (!pot || !bb) return [] as Array<{ color: string; count: number }>;
  const units = [100, 25, 5, 1, 0.5, 0.25].map((m) => m * bb);
  let left = pot;
  const stacks: Array<{ color: string; count: number }> = [];
  units.forEach((u, i) => {
    const n = Math.floor(left / u);
    if (n > 0 && stacks.length < 6) {
      stacks.push({ color: CHIP_COLORS[i]!, count: Math.min(8, n) });
      left -= n * u;
    }
  });
  if (!stacks.length) stacks.push({ color: "orange", count: 1 });
  return stacks;
}

const DEMO_NAMES = ["Luna", "Jack", "Max", "Mia", "Nova", "Leo", "Zara", "Kai"];

/**
 * A fake, read-only table for checking the layout: /table/demo?players=2..9
 * Nothing is sent to the server.
 */
export function demoView(players: number, cards = 2) {
  const myCards = ["6c", "Ah", "Kd", "Qs", "Jh", "Tc"].slice(0, Math.max(2, Math.min(6, cards)));
  const n = Math.min(9, Math.max(2, Math.round(players) || 6));
  const seats = Array.from({ length: n }, (_, i) => ({
    seat: i,
    memberId: i === 0 ? "me" : `demo_${i}`,
    name: i === 0 ? "You" : DEMO_NAMES[i - 1]!,
    stack: 5000,
    isBot: false,
    empty: false,
  }));
  const handSeats = seats.map((s, i) => ({
    seat: s.seat,
    memberId: s.memberId!,
    name: s.name,
    stack: i === 0 ? 4800 : 4750 + ((i * 50) % 200),
    bet: i === 0 ? 100 : i % 3 === 1 ? 50 : i % 3 === 2 ? 250 : 0,
    folded: n > 4 && i === n - 1,
    allIn: n > 5 && i === 2,
    isBot: false,
    hole: i === 0 ? myCards : myCards.map(() => "xx"),
  }));
  return {
    meMemberId: "me",
    meSeat: 0,
    table: {
      id: "demo",
      title: `Demo table · ${n} players`,
      sb: 25,
      bb: 50,
      seats: n,
      buyinMin: 2000,
      buyinMax: 10000,
      rakePercent: 0,
      rakeCapBb: 0,
      bbjpEnabled: true,
      gameType: cards >= 4 ? "PLO" : "NLH",
    },
    tournament: null,
    seats,
    hand: {
      handNo: 8743921,
      street: "river",
      board: ["6d", "5c", "5d", "Ac", "6h"],
      button: Math.min(2, n - 1),
      toAct: 0,
      pot: 1250,
      currentBet: 50,
      log: ["Demo hand — layout preview only."],
      result: null,
      seats: handSeats,
    },
    handStrength: {
      label: "FULL HOUSE",
      premium: null,
      intensity: 1,
      made: true,
      madeCards: ["6c", "6d", "6h", "5c", "5d"],
    },
    cosmetics: null,
    actions: [
      { type: "fold", label: "Fold" },
      { type: "call", label: "Call", amount: 50 },
      { type: "allin", label: "All-in", amount: 4800 },
    ],
    sizing: { kind: "raise" as const, min: 100, max: 4800, presets: [] },
    phase: "demo",
    actionMsLeft: 18_000,
    version: 1,
    bbjp: { balance: 0, enabled: true, trigger: "AAAKK", minimumHand: "AAAKK" },
  };
}
