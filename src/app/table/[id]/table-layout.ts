/**
 * Seat geometry + demo data for the Shark Club table.
 * Positions are percentages of the table box (0–100). The hero (you) always
 * sits bottom-centre; everyone else is spread evenly around the oval.
 */

export type SeatPoint = { x: number; y: number; side: "left" | "right" | "top" };

const CX = 50;
const CY = 48;
const RX = 40;
const RY = 40;

/**
 * Point for seat `slot` (0 = bottom centre) at a table with `count` seats.
 * Up to 6 seats the spacing is perfectly even; with 7–9 seats a gap is kept
 * either side of the hero so neighbours never overlap your cards.
 */
export function seatPoint(slot: number, count: number): SeatPoint {
  if (slot === 0) return { x: 50, y: 88, side: "top" };
  let angle: number;
  if (count <= 2) {
    angle = 270;
  } else {
    const gap = count <= 6 ? 360 / count : 58;
    angle = 90 + gap + ((360 - 2 * gap) * (slot - 1)) / (count - 2);
  }
  const rad = (angle * Math.PI) / 180;
  const x = CX + RX * Math.cos(rad);
  const y = CY + RY * Math.sin(rad);
  const side = x < 42 ? "left" : x > 58 ? "right" : "top";
  return { x, y, side };
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
export function demoView(players: number) {
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
    bet: i === 0 ? 0 : i % 3 === 1 ? 50 : 0,
    folded: n > 4 && i === n - 1,
    allIn: n > 5 && i === 2,
    isBot: false,
    hole: i === 0 ? ["2c", "3h"] : ["xx", "xx"],
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
      gameType: "NLH",
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
    handStrength: { label: "Two Pair", premium: null, intensity: 1 },
    cosmetics: null,
    actions: [
      { type: "fold", label: "Fold" },
      { type: "call", label: "Call", amount: 50 },
      { type: "allin", label: "All-in", amount: 4800 },
    ],
    sizing: { kind: "raise" as const, min: 100, max: 4800, presets: [] },
    phase: "demo",
    version: 1,
    bbjp: { balance: 0, enabled: true, trigger: "AAAKK", minimumHand: "AAAKK" },
  };
}
