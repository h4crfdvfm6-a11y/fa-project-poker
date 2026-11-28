import { sql } from "./db";
import { isAvatarId } from "./looks";

/** Each player's chosen avatar (everyone at the table sees it). */
let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= sql(
    `create table if not exists member_avatars (
       member_id text primary key,
       avatar text not null,
       updated_at timestamptz not null default now()
     )`,
  )
    .then(() => undefined)
    .catch((error) => {
      ready = null;
      throw error;
    });
  return ready;
}

/** true when the player bought this shop avatar (asset path such as /banners/...) */
async function ownsShopAvatar(memberId: string, assetPath: string) {
  try {
    const rows = await sql(
      `select 1 from member_inventory mi
       join shop_catalog c on c.id = mi.item_id
       where mi.member_id = $1 and c.kind = 'avatar' and c.asset_key = $2
       limit 1`,
      [memberId, assetPath],
    );
    return rows.length > 0;
  } catch {
    // the shop tables are created the first time the shop opens
    return false;
  }
}

export async function setAvatar(memberId: string, avatar: string) {
  if (avatar.startsWith("/banners/")) {
    if (!(await ownsShopAvatar(memberId, avatar))) throw new Error("Buy that avatar in the Shop first");
  } else if (!isAvatarId(avatar)) {
    throw new Error("Unknown avatar");
  }
  await ensureTable();
  await sql(
    `insert into member_avatars (member_id, avatar) values ($1, $2)
     on conflict (member_id) do update set avatar = excluded.avatar, updated_at = now()`,
    [memberId, avatar],
  );
}

/** seat number → chosen avatar, for the players at a table who picked one */
export async function avatarsAtTable(tableId: string) {
  await ensureTable();
  const rows = await sql<{ seat_no: number; avatar: string }>(
    `select s.seat_no, a.avatar from table_seats s
     join member_avatars a on a.member_id = s.member_id
     where s.table_id = $1`,
    [tableId],
  );
  return Object.fromEntries(rows.map((r) => [String(r.seat_no), r.avatar]));
}

export async function myAvatar(memberId: string) {
  await ensureTable();
  const [r] = await sql<{ avatar: string }>(
    `select avatar from member_avatars where member_id = $1`,
    [memberId],
  );
  return r?.avatar ?? null;
}
