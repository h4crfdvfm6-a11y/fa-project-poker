import assert from "node:assert/strict";
import test from "node:test";

// Each test file runs in its own Node worker. Never use a deployment database.
process.env.DATABASE_URL = "";

void test("table funding and tournament rebuys in an isolated PGlite database", async (t) => {
  const { sql, closeDatabase } = await import("./db");
  t.after(closeDatabase);
  const { ensureClubSeeded, DEFAULT_CLUB_ID, createTournament } =
    await import("./club");
  const { requestAddOn, applyPendingAddOns } = await import("./table-addon");
  const { offerTournamentRebuys, rebuyTournament, tournamentRebuyView } =
    await import("./tournament-rebuy");
  const { getTableView, playerAction } = await import("./table-play");
  const { maybeFinishTournament } = await import("./tournament");
  const { startHand, applyAction } = await import("./poker/engine");
  await ensureClubSeeded();
  let counter = 0;
  async function fixture(tournament = true, until = 6) {
    const key = `funding_${++counter}`;
    const players = [`${key}_a`, `${key}_b`];
    for (const member of players)
      await sql(
        "insert into members (id, club_id, display_name, chip_balance) values ($1,$2,$1,20000)",
        [member, DEFAULT_CLUB_ID],
      );
    await sql(
      `insert into cash_tables (id,club_id,title,format,sb,bb,seats,buyin_min,buyin_max)
      values ($1,$2,$1,$3,10,20,2,100,1000)`,
      [key, DEFAULT_CLUB_ID, tournament ? "tournament" : "ring"],
    );
    const dealt = startHand(
      players.map((memberId, seat) => ({
        seat,
        memberId,
        name: memberId,
        stack: 1000,
        isBot: false,
        sittingOut: false,
      })),
      {
        handNo: 1,
        button: 0,
        sb: 10,
        bb: 20,
        rakePercent: 0,
        rakeCapBb: 0,
        bbjpEnabled: false,
        bbjpTrigger: "AAAKK",
        gameType: "NLH",
      },
    );
    const state = applyAction(dealt, dealt.toAct!, "fold");
    state.endedAt = Date.now() - 4000;
    state.seats[0]!.stack = 0;
    state.seats[1]!.stack = 2000;
    for (let i = 0; i < 2; i++)
      await sql(
        `insert into table_seats (table_id,seat_no,member_id,display_name,stack,is_bot,sitting_out)
      values ($1,$2,$3,$3,$4,false,$5)`,
        [key, i, players[i], i === 0 ? 0 : 2000, i === 0],
      );
    await sql(
      `insert into table_runtime (table_id,hand_no,button_seat,version,phase,state_json,settled_hand_no) values ($1,1,0,1,'showdown',$2,1)`,
      [key, JSON.stringify(state)],
    );
    if (tournament) {
      await sql(
        `insert into tournaments (id,club_id,title,buy_in,fee,starting_stack,max_players,blind_minutes,status,table_id,blind_level,level_started_at,prize_pool,rebuy_until_level)
        values ($1,$2,$1,100,10,1000,2,10,'running',$1,1,now(),200,$3)`,
        [key, DEFAULT_CLUB_ID, until],
      );
      for (const member of players)
        await sql(
          "insert into tournament_entries (tournament_id,member_id) values ($1,$2)",
          [key, member],
        );
    }
    return { key, players, state };
  }
  async function balance(memberId: string) {
    return Number(
      (
        await sql<{ chip_balance: string }>(
          "select chip_balance from members where id=$1",
          [memberId],
        )
      )[0]!.chip_balance,
    );
  }
  await t.test(
    "rebuy offer holds the final payout; double-click restores the same seat and charges once",
    async () => {
      const { key, players } = await fixture();
      const before = await getTableView(key, players[0]!);
      assert.equal(before.rebuy?.offered, true);
      assert.equal(before.tournament?.status, "running");
      const rake = Number(
        (
          await sql<{ total_rake: string }>(
            "select total_rake from club_rake where club_id=$1",
            [DEFAULT_CLUB_ID],
          )
        )[0]!.total_rake,
      );
      await Promise.all([
        rebuyTournament(key, players[0]!, 1),
        rebuyTournament(key, players[0]!, 1),
      ]);
      assert.equal(await balance(players[0]!), 19890);
      assert.equal(
        Number(
          (
            await sql<{ prize_pool: string }>(
              "select prize_pool from tournaments where id=$1",
              [key],
            )
          )[0]!.prize_pool,
        ),
        300,
      );
      assert.equal(
        Number(
          (
            await sql<{ total_rake: string }>(
              "select total_rake from club_rake where club_id=$1",
              [DEFAULT_CLUB_ID],
            )
          )[0]!.total_rake,
        ),
        rake + 10,
      );
      const after = await getTableView(key, players[0]!);
      assert.equal(after.meSeat, 0);
      assert.equal(after.hand?.handNo, 2);
      assert.equal(after.hand?.seats.find((s) => s.seat === 0)?.hole.length, 2);
      assert.equal(after.tournament?.status, "running");
    },
  );
  await t.test(
    "decline releases the table and pays the winner once",
    async () => {
      const { key, players } = await fixture();
      await offerTournamentRebuys(key);
      await rebuyTournament(key, players[0]!, 1, true);
      await Promise.all([
        maybeFinishTournament(key),
        maybeFinishTournament(key),
      ]);
      assert.equal(await balance(players[0]!), 20000);
      assert.equal(await balance(players[1]!), 20200);
    },
  );
  await t.test(
    "failed ledger write rolls back balance, seat and prize pool",
    async () => {
      const { key, players } = await fixture();
      await offerTournamentRebuys(key);
      await sql(
        "alter table chip_ledger add constraint test_rebuy_failure check (reason not like 'mtt_rebuy:%') not valid",
      );
      try {
        await assert.rejects(rebuyTournament(key, players[0]!, 1));
      } finally {
        await sql("alter table chip_ledger drop constraint test_rebuy_failure");
      }
      assert.equal(await balance(players[0]!), 20000);
      assert.equal(
        Number(
          (
            await sql<{ stack: string }>(
              "select stack from table_seats where table_id=$1 and seat_no=0",
              [key],
            )
          )[0]!.stack,
        ),
        0,
      );
      assert.equal(
        Number(
          (
            await sql<{ prize_pool: string }>(
              "select prize_pool from tournaments where id=$1",
              [key],
            )
          )[0]!.prize_pool,
        ),
        200,
      );
    },
  );
  await t.test(
    "insufficient balance, expired window and blind cutoff reject without charging",
    async () => {
      const { key, players } = await fixture();
      await offerTournamentRebuys(key);
      await sql("update members set chip_balance=50 where id=$1", [players[0]]);
      await assert.rejects(rebuyTournament(key, players[0]!, 1), /Not enough/);
      assert.equal(await balance(players[0]!), 50);
      await sql(
        "update table_seats set rebuy_deadline=now()-interval '1 second' where table_id=$1",
        [key],
      );
      await assert.rejects(rebuyTournament(key, players[0]!, 1), /expired/);
      await sql(
        "update table_seats set rebuy_deadline=now()+interval '30 seconds' where table_id=$1",
        [key],
      );
      await sql(
        "update tournaments set level_started_at=now()-interval '61 minutes' where id=$1",
        [key],
      );
      await assert.rejects(rebuyTournament(key, players[0]!, 1), /closed/);
    },
  );
  await t.test(
    "freezeouts and Spin never offer rebuys; a prior bust is not offered again",
    async () => {
      const freeze = await fixture(true, 0);
      await offerTournamentRebuys(freeze.key);
      assert.equal(
        (await tournamentRebuyView(freeze.key, freeze.players[0]!))?.offered,
        false,
      );
      const spin = await fixture();
      await sql("update tournaments set kind='spin' where id=$1", [spin.key]);
      await offerTournamentRebuys(spin.key);
      assert.equal(
        (await tournamentRebuyView(spin.key, spin.players[0]!))?.offered,
        false,
      );
      const old = await fixture();
      old.state.seats[0]!.hole = [];
      await sql("update table_runtime set state_json=$2 where table_id=$1", [
        old.key,
        JSON.stringify(old.state),
      ]);
      await offerTournamentRebuys(old.key);
      assert.equal(
        (await tournamentRebuyView(old.key, old.players[0]!))?.offered,
        false,
      );
    },
  );
  await t.test(
    "cash top-up queues mid-hand, revives a zero stack, and applies once within the maximum",
    async () => {
      const { key, players } = await fixture(false);
      await sql("update table_runtime set phase='hand' where table_id=$1", [
        key,
      ]);
      assert.deepEqual(await requestAddOn(key, players[0]!, 800), {
        added: false,
      });
      assert.equal(await applyPendingAddOns(key), 0);
      assert.equal(await balance(players[0]!), 20000);
      await sql(
        "update table_runtime set phase='waiting',state_json='{}' where table_id=$1",
        [key],
      );
      await Promise.all([applyPendingAddOns(key), applyPendingAddOns(key)]);
      assert.equal(await balance(players[0]!), 19200);
      const view = await getTableView(key, players[0]!);
      assert.equal(view.meSeat, 0);
      assert.equal(view.hand?.street, "preflop");
      assert.equal(view.seats.find((s) => s.seat === 0)?.sittingOut, false);
      await assert.rejects(requestAddOn(key, players[0]!, 1001), /up to/);
      await assert.rejects(requestAddOn(key, players[0]!, 0.5), /Enter/);
    },
  );
  await t.test(
    "cash max is rechecked after the hand and leaving cancels without debit",
    async () => {
      const { key, players } = await fixture(false);
      await sql("update table_runtime set phase='hand' where table_id=$1", [
        key,
      ]);
      await requestAddOn(key, players[0]!, 800);
      await sql(
        "update table_seats set stack=900 where table_id=$1 and seat_no=0",
        [key],
      );
      await sql(
        "update table_runtime set phase='waiting',state_json='{}' where table_id=$1",
        [key],
      );
      await applyPendingAddOns(key);
      assert.equal(await balance(players[0]!), 19900);
      const left = await fixture(false);
      await sql("update table_runtime set phase='hand' where table_id=$1", [
        left.key,
      ]);
      await requestAddOn(left.key, left.players[0]!, 800);
      await sql(
        "update table_seats set member_id=null where table_id=$1 and seat_no=0",
        [left.key],
      );
      await sql("update table_runtime set phase='waiting' where table_id=$1", [
        left.key,
      ]);
      await applyPendingAddOns(left.key);
      assert.equal(await balance(left.players[0]!), 20000);
    },
  );
  await t.test(
    "unsettled pots cannot be topped up, rebought, or paid out",
    async () => {
      const tournament = await fixture();
      await sql(
        "update table_runtime set settled_hand_no = -1 where table_id = $1",
        [tournament.key],
      );
      await offerTournamentRebuys(tournament.key);
      assert.equal(
        (await tournamentRebuyView(tournament.key, tournament.players[0]!))
          ?.offered,
        false,
      );
      assert.equal(await maybeFinishTournament(tournament.key), null);
      const cash = await fixture(false);
      await sql(
        "update table_runtime set settled_hand_no = -1 where table_id = $1",
        [cash.key],
      );
      await requestAddOn(cash.key, cash.players[0]!, 500);
      assert.equal(await applyPendingAddOns(cash.key), 0);
      assert.equal(await balance(cash.players[0]!), 20000);
    },
  );
  await t.test(
    "a played hand settles, accepts a top-up, and deals the funded stack",
    async () => {
      const { key, players } = await fixture(false);
      const state = startHand(
        players.map((memberId, seat) => ({
          seat,
          memberId,
          name: memberId,
          stack: 500,
          isBot: false,
          sittingOut: false,
        })),
        {
          handNo: 1,
          button: 0,
          sb: 10,
          bb: 20,
          rakePercent: 0,
          rakeCapBb: 0,
          bbjpEnabled: false,
          bbjpTrigger: "AAAKK",
          gameType: "NLH",
        },
      );
      await sql(
        "update table_runtime set phase='hand', settled_hand_no=-1, state_json=$2 where table_id=$1",
        [key, JSON.stringify(state)],
      );
      await sql(
        "update table_seats set stack=500,sitting_out=false where table_id=$1",
        [key],
      );
      const result = await playerAction(key, players[state.toAct!]!, "fold");
      assert.equal(result.phase, "showdown");
      const settled = await sql<{ settled_hand_no: number }>(
        "select settled_hand_no from table_runtime where table_id=$1",
        [key],
      );
      assert.equal(settled[0]?.settled_hand_no, 1);
      await requestAddOn(key, players[0]!, 200);
      assert.equal(await applyPendingAddOns(key), 1);
      const [runtime] = await sql<{ state_json: string }>(
        "select state_json from table_runtime where table_id=$1",
        [key],
      );
      const finished = JSON.parse(runtime!.state_json);
      finished.endedAt = Date.now() - 4000;
      await sql("update table_runtime set state_json=$2 where table_id=$1", [
        key,
        JSON.stringify(finished),
      ]);
      const next = await getTableView(key, players[0]!);
      assert.equal(next.hand?.handNo, 2);
      const total =
        (next.hand?.seats ?? []).reduce((sum, s) => sum + s.stack, 0) +
        (next.hand?.pot ?? 0);
      assert.equal(total, 1200);
      assert.equal(await balance(players[0]!), 19800);
    },
  );
  await t.test(
    "admin rebuy settings are validated and Spin stays a freezeout",
    async () => {
      const input = {
        title: "Settings test",
        gameType: "NLH",
        buyIn: 100,
        fee: 10,
        startingStack: 1000,
        maxPlayers: 2,
        blindMinutes: 10,
      };
      await assert.rejects(
        createTournament({ ...input, rebuyUntilLevel: 99 }),
        /0–17/,
      );
      assert.equal(
        (await createTournament({ ...input, rebuyUntilLevel: 6 }))
          .rebuy_until_level,
        6,
      );
      assert.equal(
        (await createTournament({ ...input, kind: "spin", rebuyUntilLevel: 6 }))
          .rebuy_until_level,
        0,
      );
    },
  );
});
