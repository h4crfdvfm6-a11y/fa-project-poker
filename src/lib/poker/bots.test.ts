import assert from "node:assert/strict";
import { test } from "node:test";
import { decideBotAction } from "./bots";
import { applyAction, startHand } from "./engine";
import { applyOfcSet, decideOfcBot, startOfcHand } from "./ofc";
import { applyStraddles } from "./straddle";
import { GAME_TYPES, isOfc, maxSeatsFor } from "./variants";

/** Bots only: every game must play hands to the end without an illegal move. */
for (const game of GAME_TYPES.filter((g) => !isOfc(g))) {
  test(`${game}: full table of bots finishes 100 hands`, () => {
    const n = maxSeatsFor(game);
    for (let h = 0; h < 100; h++) {
      let s = startHand(
        Array.from({ length: n }, (_, i) => ({
          seat: i,
          memberId: `b${i}`,
          name: `B${i}`,
          stack: 2000,
          isBot: true,
          sittingOut: false,
        })),
        {
          handNo: h + 1,
          button: h % n,
          sb: 25,
          bb: 50,
          rakePercent: 5,
          rakeCapBb: 3,
          bbjpEnabled: false,
          bbjpTrigger: "AAAKK",
          gameType: game,
        },
      );
      // half the hands with straddles, so bots also face a straddle
      if (h % 2) {
        s = applyStraddles(s, {
          straddle: true,
          mississippi: h % 4 === 1,
          straddleSeats: [...Array(n).keys()],
          mississippiSeats: [0, 2],
        });
      }
      for (let guard = 0; s.toAct != null && s.street !== "showdown" && guard < 500; guard++) {
        const d = decideBotAction(s, s.toAct);
        s = applyAction(s, s.toAct, d.type, d.amount ?? 0);
      }
      assert.equal(s.street, "showdown");
    }
  });
}

test("OFC Pineapple: 3 bots finish 100 hands", () => {
  for (let h = 0; h < 100; h++) {
    let s = startOfcHand(
      [0, 1, 2].map((i) => ({
        seat: i,
        memberId: `o${i}`,
        name: `O${i}`,
        stack: 5000,
        isBot: true,
        fantasy: h % 7 === 0 && i === 1,
      })),
      { handNo: h + 1, button: h % 3, unit: 50 },
    );
    for (let guard = 0; s.toAct != null && s.street !== "showdown" && guard < 200; guard++) {
      const d = decideOfcBot(s, s.toAct);
      s = applyOfcSet(s, s.toAct, d.placements, d.discardIndex);
    }
    assert.equal(s.street, "showdown");
  }
});
