/** Ephemeral table reactions — process memory, short-lived, rate-limited. */

export type Reaction = {
  id: string;
  tableId: string;
  seat: number;
  emoji: string;
  name: string;
  at: number;
};

const FREE = ["😂", "😎", "🔥", "😱", "👏", "❤️", "😭", "🤔", "🎉"];
const FIRE_PACK = ["💥", "🚀", "🫠", "👀"];

const byTable = new Map<string, Reaction[]>();
const lastByMember = new Map<string, number>();
const COOLDOWN_MS = 4000;
const TTL_MS = 3500;
const MAX_TABLE_KEYS = 200;
const MAX_ID_LEN = 64;

export function freeEmojis() {
  return FREE;
}

function validTableId(tableId: string): boolean {
  return (
    typeof tableId === "string" &&
    tableId.length > 0 &&
    tableId.length <= MAX_ID_LEN &&
    /^[\w-]+$/.test(tableId)
  );
}

function pruneExpired(now: number) {
  for (const [id, list] of byTable) {
    const kept = list.filter((r) => now - r.at < TTL_MS * 3);
    if (kept.length === 0) byTable.delete(id);
    else byTable.set(id, kept);
  }
  for (const [memberId, at] of lastByMember) {
    if (now - at > COOLDOWN_MS * 30) lastByMember.delete(memberId);
  }
}

export function postReaction(input: {
  tableId: string;
  memberId: string;
  seat: number;
  name: string;
  emoji: string;
  allowFirePack?: boolean;
}): Reaction {
  if (!validTableId(input.tableId)) throw new Error("Invalid table");
  const allowed = input.allowFirePack ? [...FREE, ...FIRE_PACK] : FREE;
  if (!allowed.includes(input.emoji)) throw new Error("Unknown reaction");
  const now = Date.now();
  pruneExpired(now);
  const last = lastByMember.get(input.memberId) ?? 0;
  if (now - last < COOLDOWN_MS) throw new Error("Slow down reactions");
  lastByMember.set(input.memberId, now);
  const reaction: Reaction = {
    id: `rx_${now}_${input.seat}`,
    tableId: input.tableId,
    seat: input.seat,
    emoji: input.emoji,
    name: input.name,
    at: now,
  };
  const list = byTable.get(input.tableId) ?? [];
  list.push(reaction);
  if (!byTable.has(input.tableId) && byTable.size >= MAX_TABLE_KEYS) {
    // Evict oldest empty-ish key if at cap (should be rare after prune).
    const first = byTable.keys().next().value;
    if (first) byTable.delete(first);
  }
  byTable.set(
    input.tableId,
    list.filter((r) => now - r.at < TTL_MS * 3).slice(-20),
  );
  return reaction;
}

/** Read-only: never creates Map entries for unknown / empty tables. */
export function listReactions(tableId: string): Reaction[] {
  if (!validTableId(tableId)) return [];
  const now = Date.now();
  const existing = byTable.get(tableId);
  if (!existing) return [];
  const list = existing.filter((r) => now - r.at < TTL_MS);
  if (list.length === 0) {
    byTable.delete(tableId);
    return [];
  }
  byTable.set(tableId, list);
  return list;
}
