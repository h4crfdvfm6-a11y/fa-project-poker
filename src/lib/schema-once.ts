import { sql } from "./db";

/** Run schema DDL at most once per process to avoid ALTER locks on every request. */
const ready = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/**
 * True when every (table, column) already exists. Checking first avoids
 * running ALTER TABLE on each fresh server: ALTER locks the whole table until
 * every running query on it finishes, which stalled the first table load.
 */
export async function hasColumns(cols: Array<[table: string, column: string]>) {
  const tables = [...new Set(cols.map(([t]) => t))];
  const rows = await sql<{ t: string; c: string }>(
    `select table_name as t, column_name as c from information_schema.columns
     where table_schema = current_schema() and table_name = any($1::text[])`,
    [tables],
  );
  const have = new Set(rows.map((r) => `${r.t}.${r.c}`));
  return cols.every(([t, c]) => have.has(`${t}.${c}`));
}

export async function ensureOnce(
  key: string,
  setup: () => Promise<void>,
): Promise<void> {
  if (ready.has(key)) return;
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      await setup();
      ready.add(key);
      inflight.delete(key);
    })().catch((error) => {
      inflight.delete(key);
      throw error;
    });
    inflight.set(key, pending);
  }
  await pending;
}
