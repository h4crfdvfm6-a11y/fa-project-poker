import { sql } from "./db";
import { addBot, getTableView, leaveTable } from "./table-play";

/**
 * TEST MODE — bots keep every cash table full so there is always a game.
 * When a person opens a table and there's no free seat, one bot leaves so they
 * can sit. Turn off by setting TEST_BOTS to false (or env TEST_BOTS=0).
 */
export const TEST_BOTS = process.env.TEST_BOTS !== "0";

/** While someone is looking for a seat, bots don't take the free one back. */
const HOLD_SECONDS = 20;

type TableInfo = { format: string; status: string; hold_active: boolean };

async function tableInfo(tableId: string) {
  const [t] = await sql<TableInfo>(
    `select format, status, coalesce(bot_hold_until > now(), false) as hold_active
     from cash_tables where id = $1`,
    [tableId],
  );
  return t;
}

async function betweenHands(tableId: string) {
  const [r] = await sql<{ state_json: string }>(
    `select state_json from table_runtime where table_id = $1`,
    [tableId],
  );
  if (!r || !r.state_json || r.state_json === "{}") return true;
  const street = (JSON.parse(r.state_json) as { street?: string }).street;
  return !street || street === "waiting" || street === "showdown";
}

async function seatsOf(tableId: string) {
  return sql<{ seat_no: number; member_id: string | null; is_bot: boolean }>(
    `select seat_no, member_id, is_bot from table_seats where table_id = $1 order by seat_no`,
    [tableId],
  );
}

/** Called on every table poll. Only acts between hands. */
export async function manageTestBots(tableId: string, viewerId: string | null) {
  if (!TEST_BOTS) return;
  const table = await tableInfo(tableId);
  if (!table || table.format === "tournament" || table.status !== "open") return;
  if (!(await betweenHands(tableId))) return;

  const seats = await seatsOf(tableId);
  const viewerSeated = Boolean(viewerId && seats.some((s) => s.member_id === viewerId));
  const empty = seats.filter((s) => !s.member_id);

  // A person is here without a seat: keep one seat free for them.
  if (viewerId && !viewerSeated) {
    await sql(
      `update cash_tables set bot_hold_until = now() + interval '${HOLD_SECONDS} seconds' where id = $1`,
      [tableId],
    );
    if (!empty.length) {
      const bot = [...seats].reverse().find((s) => s.is_bot && s.member_id);
      if (bot?.member_id) await leaveTable(tableId, bot.member_id).catch(() => undefined);
    }
    return;
  }

  // Otherwise fill every empty seat with a bot (unless someone is joining).
  if (table.hold_active || !empty.length) return;
  for (const s of empty) {
    try {
      await addBot(tableId, s.seat_no);
    } catch {
      break; // hand started or no chips left in the bot float
    }
  }
}

/**
 * Sitting down in test mode: bots play continuously, so wait (while driving the
 * bots) until the current hand ends, then the seat can be taken.
 */
export async function waitForBetweenHands(tableId: string, maxMs = 45_000) {
  if (!TEST_BOTS) return;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sql(
      `update cash_tables set bot_hold_until = now() + interval '${HOLD_SECONDS} seconds' where id = $1`,
      [tableId],
    );
    if (await betweenHands(tableId)) return;
    await getTableView(tableId, null, { advance: true }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
  }
}
