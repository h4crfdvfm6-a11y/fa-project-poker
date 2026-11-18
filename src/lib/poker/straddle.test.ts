import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAction, startHand, type EngineState } from "./engine";
import { applyStraddles } from "./straddle";

function table(n: number, button = 0, stacks: number[] = []) {
  return startHand(
    Array.from({ length: n }, (_, i) => ({
      seat: i,
      memberId: `m${i}`,
      name: `P${i}`,
      stack: stacks[i] ?? 10_000,
      isBot: false,
      sittingOut: false,
    })),
    {
      handNo: 1,
      button,
      sb: 25,
      bb: 50,
      rakePercent: 0,
      rakeCapBb: 0,
      bbjpEnabled: false,
      bbjpTrigger: "AAAKK",
      gameType: "NLH",
    },
  );
}

const bet = (s: EngineState, seat: number) => s.seats.find((x) => x.seat === seat)!.bet;

test("no straddle ticked: nothing changes", () => {
  const s = applyStraddles(table(6), {
    straddle: true,
    mississippi: true,
    straddleSeats: [],
    mississippiSeats: [],
  });
  assert.equal(s.currentBet, 50);
  assert.equal(s.toAct, 3); // UTG
});

test("UTG straddle: 100, UTG+1 acts first, straddler acts last", () => {
  // button 0, SB 1, BB 2, UTG 3
  const s = applyStraddles(table(6), {
    straddle: true,
    mississippi: false,
    straddleSeats: [3],
    mississippiSeats: [],
  });
  assert.equal(bet(s, 3), 100);
  assert.equal(s.currentBet, 100);
  assert.equal(s.minRaise, 100);
  assert.equal(s.toAct, 4);
  // everyone calls round to the straddler, who still gets to act
  let st = s;
  for (const seat of [4, 5, 0, 1, 2]) st = applyAction(st, seat, "call");
  assert.equal(st.street, "preflop");
  assert.equal(st.toAct, 3);
  st = applyAction(st, 3, "check");
  assert.equal(st.street, "flop");
});

test("unlimited re-straddles in turn: 100, 200, 400, 800 up to the button", () => {
  const s = applyStraddles(table(7), {
    straddle: true,
    mississippi: false,
    straddleSeats: [3, 4, 5, 6, 0],
    mississippiSeats: [],
  });
  assert.equal(bet(s, 3), 100);
  assert.equal(bet(s, 4), 200);
  assert.equal(bet(s, 5), 400);
  assert.equal(bet(s, 6), 800);
  assert.equal(bet(s, 0), 1600); // button too
  assert.equal(s.currentBet, 1600);
  assert.equal(s.toAct, 1); // small blind acts first
});

test("chain stops at the first player who didn't tick it", () => {
  const s = applyStraddles(table(7), {
    straddle: true,
    mississippi: false,
    straddleSeats: [3, 5, 6],
    mississippiSeats: [],
  });
  assert.equal(bet(s, 3), 100);
  assert.equal(bet(s, 5), 0);
  assert.equal(s.toAct, 4);
});

test("UTG must straddle first for anyone else to straddle", () => {
  const s = applyStraddles(table(6), {
    straddle: true,
    mississippi: false,
    straddleSeats: [4, 5],
    mississippiSeats: [],
  });
  assert.equal(s.currentBet, 50);
  assert.equal(s.toAct, 3);
});

test("not enough chips for the full straddle: no straddle", () => {
  const s = applyStraddles(table(6, 0, [10_000, 10_000, 10_000, 90]), {
    straddle: true,
    mississippi: false,
    straddleSeats: [3],
    mississippiSeats: [],
  });
  assert.equal(bet(s, 3), 0);
  assert.equal(s.currentBet, 50);
});

test("Mississippi: closest to the button wins, action starts on its left", () => {
  // button 0, SB 1, BB 2; seats 4 and 5 (cut-off) and 0 (button) want it
  const s = applyStraddles(table(6), {
    straddle: false,
    mississippi: true,
    straddleSeats: [],
    mississippiSeats: [4, 5, 0],
  });
  assert.equal(bet(s, 0), 100); // the button gets it
  assert.equal(bet(s, 4), 0);
  assert.equal(bet(s, 5), 0);
  assert.equal(s.toAct, 1); // small blind first
  let st = s;
  for (const seat of [1, 2, 3, 4, 5]) st = applyAction(st, seat, "call");
  assert.equal(st.toAct, 0); // button acts last
});

test("Mississippi: cut-off beats the hijack when the button hasn't ticked it", () => {
  const s = applyStraddles(table(6), {
    straddle: false,
    mississippi: true,
    straddleSeats: [],
    mississippiSeats: [4, 5],
  });
  assert.equal(bet(s, 5), 100);
  assert.equal(bet(s, 4), 0);
  assert.equal(s.toAct, 0); // button acts first, cut-off last
});

test("Mississippi replaces normal straddles; blinds can't Mississippi", () => {
  const s = applyStraddles(table(6), {
    straddle: true,
    mississippi: true,
    straddleSeats: [3, 4],
    mississippiSeats: [1, 2, 4],
  });
  assert.equal(bet(s, 4), 100);
  assert.equal(bet(s, 3), 0);
  assert.equal(s.currentBet, 100);
});

test("no straddles heads-up or with 2 players", () => {
  const s = applyStraddles(table(2), {
    straddle: true,
    mississippi: true,
    straddleSeats: [0, 1],
    mississippiSeats: [0, 1],
  });
  assert.equal(s.currentBet, 50);
});

test("min raise after a 100 straddle is to 200", () => {
  const s = applyStraddles(table(6), {
    straddle: true,
    mississippi: false,
    straddleSeats: [3],
    mississippiSeats: [],
  });
  assert.throws(() => applyAction(s, 4, "raise", 150), /Min raise/);
  const ok = applyAction(s, 4, "raise", 200);
  assert.equal(ok.currentBet, 200);
});
