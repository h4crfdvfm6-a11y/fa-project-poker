import { DEFAULT_CLUB_ID, ensureClubSeeded, num } from "./club";
import { sql, withTransaction } from "./db";
import { id } from "./ids";
import { ensureOnce } from "./schema-once";
import { DECKS, FACES } from "./looks";

export type ShopItem = {
  id: string;
  kind: string;
  title: string;
  description: string;
  gem_price: number;
  copper_price: number;
  price_cents: number;
  grants_copper: number;
  theme: string;
  chip_amount: string | number;
  asset_key: string;
  sort_order: number;
  active: boolean;
};

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];

type Seed = {
  id: string;
  kind: string;
  title: string;
  description: string;
  copper_price: number;
  price_cents: number;
  grants_copper: number;
  chip_amount: number;
  asset_key: string;
  theme: string;
};

const SEEDS: Seed[] = [];

function item(
  p: Pick<Seed, "id" | "kind" | "title" | "description" | "asset_key"> & Partial<Seed>,
) {
  SEEDS.push({
    copper_price: 0,
    price_cents: 0,
    grants_copper: 0,
    chip_amount: 0,
    theme: "",
    ...p,
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// ---- Free items: felts ----
item({ id: "felt_midnight", kind: "felt", title: "Midnight Felt", description: "Deep blue table felt", asset_key: "felt_midnight" });
item({ id: "felt_ember", kind: "felt", title: "Ember Felt", description: "Warm ember table felt", asset_key: "felt_ember" });
item({ id: "felt_jade", kind: "felt", title: "Jade Felt", description: "Classic jade table felt", asset_key: "felt_jade" });

// ---- Card backs: the dark back is free (the default); the others cost copper ----
for (const d of DECKS) {
  if (d.id === "dark") continue;
  item({
    id: `deck_${d.id}`,
    kind: "card_back",
    title: `${d.label} Card Back`,
    description: "Card back for the table",
    asset_key: d.src,
    copper_price: 150,
  });
}

// ---- Card faces: the classic face is free (the default); the others cost copper ----
for (const f of FACES) {
  if (f.id === "classic") continue;
  item({
    id: `face_${f.id}`,
    kind: "card_face",
    title: `${f.label} Cards`,
    description: "Card faces for the table",
    asset_key: `face_${f.id}`,
    copper_price: 150,
  });
}

// ---- Theme sets: the package bundles the rest ----
const THEMES = [
  {
    key: "casino",
    label: "Casino",
    avatars: range(10).map((n) => `/banners/Poker_Theme_Pack/casino/avatars/casino-${pad(n)}.png`),
    backgrounds: [
      "art-deco-baccarat-salon",
      "las-vegas-high-limit-room",
      "london-private-card-club",
      "macau-jade-and-bronze-gaming-hall",
      "riviera-casino-terrace",
    ].map((f) => `/banners/Poker_Theme_Pack/casino/backgrounds/${f}.webp`),
  },
  {
    key: "holiday",
    label: "Holiday",
    avatars: range(10).map((n) => `/banners/Poker_Theme_Pack/holiday/avatars/holiday-${pad(n)}.png`),
    backgrounds: [
      "alpine-ski-chalet",
      "greek-island-sunset-patio",
      "kyoto-lantern-garden-inn",
      "marrakesh-riad",
      "sicilian-lemon-courtyard",
    ].map((f) => `/banners/Poker_Theme_Pack/holiday/backgrounds/${f}.webp`),
  },
  {
    key: "nature",
    label: "Nature",
    avatars: range(10).map((n) => `/banners/Poker_Theme_Pack/nature/Animal_Avatars/avatar-copper-${pad(n)}.png`),
    backgrounds: [
      "alpine-wildflower-meadow",
      "arizona-red-rock-canyon",
      "bamboo-forest-glade",
      "canadian-mountain-lakeside",
      "redwood-forest-clearing",
    ].map((f) => `/banners/Poker_Theme_Pack/nature/backgrounds/${f}.webp`),
  },
  {
    key: "urban",
    label: "Urban",
    avatars: range(10).map((n) => `/banners/Poker_Theme_Pack/urban/avatars/urban-${pad(n)}.png`),
    backgrounds: [
      "berlin-street-art-courtyard",
      "brooklyn-loft-skyline",
      "hong-kong-night-terrace",
      "london-railway-arch-studio",
      "rainy-tokyo-rooftop",
    ].map((f) => `/banners/Poker_Theme_Pack/urban/backgrounds/${f}.webp`),
  },
];

// Only ONE avatar in the whole shop is free per account: the first casino avatar.
const FREE_AVATAR_ID = "casino_avatar_01";

for (const t of THEMES) {
  t.avatars.forEach((path, i) =>
    item({
      id: `${t.key}_avatar_${pad(i + 1)}`,
      kind: "avatar",
      title: `${t.label} Avatar ${i + 1}`,
      description: `${t.label} theme avatar`,
      asset_key: path,
      copper_price: `${t.key}_avatar_${pad(i + 1)}` === FREE_AVATAR_ID ? 0 : 200,
      theme: t.key,
    }),
  );
  t.backgrounds.forEach((path, i) =>
    item({
      id: `${t.key}_background_${pad(i + 1)}`,
      kind: "background",
      title: `${t.label} Background ${i + 1}`,
      description: `${t.label} theme table background`,
      asset_key: path,
      copper_price: i === 0 ? 0 : 300,
      theme: t.key,
    }),
  );
  item({
    id: `${t.key}_package`,
    kind: "theme_package",
    title: `${t.label} Package`,
    description: `All paid ${t.label} avatars and backgrounds`,
    asset_key: "",
    copper_price: 500,
    theme: t.key,
  });
}

// ---- Sea theme: the older Shark Club art, all paid (no free items) ----
const SEA_AVATARS = [
  "Amber-Eyed Octopus Poker Strategist-2.png",
  "Burnt-orange cuttlefish illusionist-4.png",
  "Crimson lobster admiral-6.png",
  "Emerald Turtle Navigator-3.png",
  "Glacier Blue Orca Guardian-8.png",
  "Golden Pufferfish Scout-10.png",
  "Golden Seahorse Ocean Poker Herald-5.png",
  "Great White Shark Captain-1.png",
  "Midnight anglerfish poker avatar-7.png",
  "Red-Neckerchief Dolphin Racer-9.png",
];
const SEA_BACKGROUNDS = [
  "room-cove.jpg",
  "room-lighthouse.jpg",
  "room-reef.jpg",
  "room-ship.jpg",
];

SEA_AVATARS.forEach((file, i) =>
  item({
    id: `sea_avatar_${pad(i + 1)}`,
    kind: "avatar",
    title: `Sea Avatar ${i + 1}`,
    description: "Sea theme avatar",
    asset_key: `/banners/${file}`,
    copper_price: 100,
    theme: "sea",
  }),
);
SEA_BACKGROUNDS.forEach((file, i) =>
  item({
    id: `sea_background_${pad(i + 1)}`,
    kind: "background",
    title: `Sea Background ${i + 1}`,
    description: "Sea theme table background",
    asset_key: `/banners/${file}`,
    copper_price: 100,
    theme: "sea",
  }),
);
item({
  id: "sea_package",
  kind: "theme_package",
  title: "Sea Package",
  description: "All sea avatars and backgrounds",
  asset_key: "",
  copper_price: 300,
  theme: "sea",
});

// ---- Table reactions ----
item({ id: "react_fire", kind: "reaction_pack", title: "Fire Reactions", description: "Extra table reaction pack", asset_key: "react_fire", copper_price: 100 });

// ---- Copper coins, bought with real money (store billing not yet connected) ----
item({ id: "copper_pack_100", kind: "copper_pack", title: "100 Copper", description: "100 copper coins", asset_key: "", grants_copper: 100, price_cents: 99 });
item({ id: "copper_pack_550", kind: "copper_pack", title: "550 Copper", description: "550 copper coins, 10% bonus", asset_key: "", grants_copper: 550, price_cents: 499 });
item({ id: "copper_pack_1200", kind: "copper_pack", title: "1,200 Copper", description: "1,200 copper coins, 20% bonus", asset_key: "", grants_copper: 1200, price_cents: 999 });
item({ id: "copper_pack_2600", kind: "copper_pack", title: "2,600 Copper", description: "2,600 copper coins, 30% bonus", asset_key: "", grants_copper: 2600, price_cents: 1999 });

// ---- Chip packs, bought with real money (store billing not yet connected) ----
item({ id: "pack_chips_10k", kind: "chip_pack", title: "10,000 Chips", description: "Play money chips, no cash-out", asset_key: "", chip_amount: 10000, price_cents: 99 });
item({ id: "pack_chips_60k", kind: "chip_pack", title: "60,000 Chips", description: "Play money chips, no cash-out", asset_key: "", chip_amount: 60000, price_cents: 499 });
item({ id: "pack_chips_150k", kind: "chip_pack", title: "150,000 Chips", description: "Play money chips, no cash-out", asset_key: "", chip_amount: 150000, price_cents: 999 });

// Items from the old catalog that are no longer sold (gem prices, emoji avatars, the old free card backs).
const RETIRED_IDS = [
  "pack_starter",
  "pack_plus",
  "pack_stack",
  "avatar_fox",
  "avatar_owl",
  "avatar_crown",
  "back_gold",
  "back_rose",
];

async function ensureShopSchema() {
  // v3: card backs and card faces are sold; the dark back and classic face stay free
  await ensureOnce("shop-schema-copper-v3", async () => {
    await sql(`alter table members add column if not exists gem_balance integer not null default 0`);
    await sql(`alter table members add column if not exists copper_balance integer not null default 0`);
    await sql(
      `alter table members add column if not exists equipped_avatar text not null default 'avatar_default'`,
    );
    await sql(
      `alter table members add column if not exists equipped_felt text not null default 'felt_classic'`,
    );
    await sql(
      `alter table members add column if not exists equipped_card_back text not null default 'back_navy'`,
    );
    await sql(
      `create table if not exists shop_catalog (
         id text primary key,
         kind text not null,
         title text not null,
         description text not null default '',
         gem_price integer not null default 0,
         chip_amount numeric(14, 2) not null default 0,
         asset_key text not null default '',
         sort_order integer not null default 0,
         active boolean not null default true
       )`,
    );
    await sql(`alter table shop_catalog add column if not exists copper_price integer not null default 0`);
    await sql(`alter table shop_catalog add column if not exists price_cents integer not null default 0`);
    await sql(`alter table shop_catalog add column if not exists grants_copper integer not null default 0`);
    await sql(`alter table shop_catalog add column if not exists theme text not null default ''`);
    await sql(
      `create table if not exists member_inventory (
         member_id text not null references members(id),
         item_id text not null references shop_catalog(id),
         acquired_at timestamptz not null default now(),
         primary key (member_id, item_id)
       )`,
    );
    await sql(
      `create table if not exists shop_purchases (
         id text primary key,
         member_id text not null references members(id),
         item_id text not null,
         gems_spent integer not null default 0,
         chips_granted numeric(14, 2) not null default 0,
         created_at timestamptz not null default now()
       )`,
    );
    await sql(`alter table shop_purchases add column if not exists copper_spent integer not null default 0`);
    await sql(
      `create table if not exists copper_ledger (
         id text primary key,
         member_id text not null references members(id),
         amount integer not null,
         reason text not null default '',
         created_at timestamptz not null default now()
       )`,
    );
    for (const [index, seed] of SEEDS.entries()) {
      await sql(
        `insert into shop_catalog (
           id, kind, title, description, gem_price, chip_amount, asset_key, sort_order, active,
           copper_price, price_cents, grants_copper, theme
         ) values ($1,$2,$3,$4,0,$5,$6,$7,true,$8,$9,$10,$11)
         on conflict (id) do update set
           kind = excluded.kind,
           title = excluded.title,
           description = excluded.description,
           chip_amount = excluded.chip_amount,
           asset_key = excluded.asset_key,
           sort_order = excluded.sort_order,
           active = true,
           copper_price = excluded.copper_price,
           price_cents = excluded.price_cents,
           grants_copper = excluded.grants_copper,
           theme = excluded.theme`,
        [
          seed.id,
          seed.kind,
          seed.title,
          seed.description,
          seed.chip_amount,
          seed.asset_key,
          (index + 1) * 10,
          seed.copper_price,
          seed.price_cents,
          seed.grants_copper,
          seed.theme,
        ],
      );
    }
    await sql(`update shop_catalog set active = false where id = any($1::text[])`, [RETIRED_IDS]);
  });
}

export async function listShopCatalog() {
  await ensureClubSeeded();
  await ensureShopSchema();
  return sql<ShopItem>(
    `select * from shop_catalog where active = true order by sort_order, title`,
  );
}

export async function getMemberCosmetics(memberId: string) {
  await ensureClubSeeded();
  await ensureShopSchema();
  const rows = await sql<{
    gem_balance: number;
    copper_balance: number;
    chip_balance: string | number;
    equipped_avatar: string;
    equipped_felt: string;
    equipped_card_back: string;
    display_name: string;
  }>(
    `select gem_balance, copper_balance, chip_balance, equipped_avatar, equipped_felt,
            equipped_card_back, display_name
     from members where id = $1`,
    [memberId],
  );
  if (!rows[0]) throw new Error("Player not found");
  const owned = await sql<{ item_id: string }>(
    `select item_id from member_inventory where member_id = $1`,
    [memberId],
  );
  return {
    ...rows[0],
    chip_balance: num(rows[0].chip_balance),
    owned: owned.map((o) => o.item_id),
  };
}

/** Admin / promo grant of premium gems (legacy). */
export async function grantGems(memberId: string, amount: number, reason = "admin_gems") {
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Bad gem amount");
  await ensureClubSeeded();
  await ensureShopSchema();
  const updated = await sql(
    `update members set gem_balance = gem_balance + $1
     where id = $2 and gem_balance + $1 >= 0
     returning id, gem_balance`,
    [Math.trunc(amount), memberId],
  );
  if (!updated.length) throw new Error("Player not found or insufficient gems");
  await sql(
    `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
     values ($1,$2,$3,$4,$5,'admin')`,
    [id("led"), DEFAULT_CLUB_ID, memberId, amount, reason],
  );
  return updated[0];
}

/** Admin grant of copper coins (testing, promos, and later store fulfilment). */
export async function grantCopper(memberId: string, amount: number, reason = "admin_copper") {
  if (!Number.isInteger(amount) || amount === 0) throw new Error("Bad copper amount");
  await ensureClubSeeded();
  await ensureShopSchema();
  await withTransaction(async (q) => {
    await creditCopper(q, memberId, amount, reason);
  });
  return getMemberCosmetics(memberId);
}

async function creditCopper(q: Tx, memberId: string, amount: number, reason: string) {
  const updated = await q(
    `update members set copper_balance = copper_balance + $1
     where id = $2 and copper_balance + $1 >= 0
     returning id`,
    [amount, memberId],
  );
  if (!updated.length) throw new Error("Player not found or insufficient copper");
  await q(
    `insert into copper_ledger (id, member_id, amount, reason) values ($1,$2,$3,$4)`,
    [id("cu"), memberId, amount, reason],
  );
}

async function spendCopper(q: Tx, memberId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const spent = await q(
    `update members set copper_balance = copper_balance - $1
     where id = $2 and copper_balance >= $1
     returning id`,
    [amount, memberId],
  );
  if (!spent.length) throw new Error("Not enough copper");
  await q(
    `insert into copper_ledger (id, member_id, amount, reason) values ($1,$2,$3,$4)`,
    [id("cu"), memberId, -amount, reason],
  );
}

export async function purchaseShopItem(memberId: string, itemId: string) {
  await ensureClubSeeded();
  await ensureShopSchema();
  const [item] = await sql<ShopItem>(
    `select * from shop_catalog where id = $1 and active = true`,
    [itemId],
  );
  if (!item) throw new Error("Item not found");
  if (num(item.price_cents) > 0) {
    throw new Error("Store payments are not connected yet");
  }

  const price = num(item.copper_price);
  const chips = num(item.chip_amount);
  const copperGrant = num(item.grants_copper);

  await withTransaction(async (q) => {
    if (item.kind === "theme_package") {
      const missing = await q<{ id: string }>(
        `select c.id from shop_catalog c
         where c.theme = $1 and c.kind in ('avatar','background') and c.active = true
           and not exists (
             select 1 from member_inventory mi
             where mi.member_id = $2 and mi.item_id = c.id
           )`,
        [item.theme, memberId],
      );
      if (!missing.length) throw new Error("Already owned");
      await spendCopper(q, memberId, price, `shop:${item.id}`);
      for (const m of missing) {
        await q(
          `insert into member_inventory (member_id, item_id) values ($1,$2) on conflict do nothing`,
          [memberId, m.id],
        );
      }
    } else {
      if (item.kind !== "chip_pack" && item.kind !== "copper_pack") {
        // Claim ownership first so concurrent buyers cannot both debit copper.
        const claimed = await q(
          `insert into member_inventory (member_id, item_id) values ($1,$2)
           on conflict do nothing
           returning member_id`,
          [memberId, item.id],
        );
        if (!claimed.length) throw new Error("Already owned");
      }

      await spendCopper(q, memberId, price, `shop:${item.id}`);

      if (copperGrant > 0) {
        await creditCopper(q, memberId, copperGrant, `shop:${item.id}`);
      }

      if (item.kind === "chip_pack" && chips > 0) {
        const updated = await q(
          `update members
           set chip_balance = chip_balance + $1
           where id = $2 and chip_balance + $1 >= 0
           returning id`,
          [chips, memberId],
        );
        if (!updated.length) throw new Error("Player not found");
        await q(
          `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
           values ($1,$2,$3,$4,$5,'admin')`,
          [id("led"), DEFAULT_CLUB_ID, memberId, chips, `shop:${item.id}`],
        );
      } else if (item.asset_key) {
        if (item.kind === "avatar") {
          await q(`update members set equipped_avatar = $1 where id = $2`, [item.asset_key, memberId]);
        } else if (item.kind === "felt") {
          await q(`update members set equipped_felt = $1 where id = $2`, [item.asset_key, memberId]);
        }
      }
    }

    await q(
      `insert into shop_purchases (id, member_id, item_id, gems_spent, chips_granted, copper_spent)
       values ($1,$2,$3,0,$4,$5)`,
      [id("buy"), memberId, item.id, chips, price],
    );
  });

  return getMemberCosmetics(memberId);
}

export async function equipCosmetic(
  memberId: string,
  kind: "avatar" | "felt" | "card_back",
  assetKey: string,
) {
  await ensureClubSeeded();
  await ensureShopSchema();
  if (assetKey.endsWith("_default") || assetKey === "felt_classic" || assetKey === "back_navy") {
    // defaults always allowed
  } else {
    const owned = await sql(
      `select 1 from member_inventory mi
       join shop_catalog c on c.id = mi.item_id
       where mi.member_id = $1 and c.asset_key = $2 and c.kind = $3`,
      [memberId, assetKey, kind],
    );
    if (!owned.length) throw new Error("You do not own that cosmetic");
  }
  if (kind === "avatar") {
    await sql(`update members set equipped_avatar = $1 where id = $2`, [assetKey, memberId]);
  } else if (kind === "felt") {
    await sql(`update members set equipped_felt = $1 where id = $2`, [assetKey, memberId]);
  } else {
    await sql(`update members set equipped_card_back = $1 where id = $2`, [assetKey, memberId]);
  }
  return getMemberCosmetics(memberId);
}

export {
  AVATAR_GLYPH,
  CARD_BACK_STYLES,
  FELT_STYLES,
} from "./cosmetics";
