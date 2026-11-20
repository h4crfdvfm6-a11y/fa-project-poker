import { sql } from "./db";
import { ensureOnce, hasColumns } from "./schema-once";

/** All cash-table / runtime columns needed for squid + hand economy. */
export async function ensureTablePlaySchema() {
  await ensureOnce("table-play-schema-v3", async () => {
    if (
      await hasColumns([
        ["table_runtime", "squid_json"],
        ["table_runtime", "squid_hand_no"],
        ["table_runtime", "squid_ante_hand_no"],
        ["table_runtime", "economy_hand_no"],
        ["table_runtime", "settled_hand_no"],
        ["cash_tables", "squid_enabled"],
        ["cash_tables", "squid_target"],
        ["cash_tables", "cucurucho_enabled"],
        ["cash_tables", "cucurucho_ante_bb"],
        ["cash_tables", "cucurucho_every_hands"],
      ])
    ) {
      return;
    }
    await sql(
      `alter table table_runtime
       add column if not exists squid_json text not null default '{}'`,
    );
    await sql(
      `alter table table_runtime
       add column if not exists squid_hand_no int not null default 0`,
    );
    await sql(
      `alter table table_runtime
       add column if not exists squid_ante_hand_no int not null default 0`,
    );
    await sql(
      `alter table table_runtime
       add column if not exists economy_hand_no int not null default 0`,
    );
    await sql(
      `alter table table_runtime add column if not exists settled_hand_no int not null default -1`,
    );
    await sql(
      `update table_runtime set settled_hand_no = hand_no where phase = 'showdown'`,
    );
    await sql(
      `alter table cash_tables
       add column if not exists squid_enabled boolean not null default false`,
    );
    await sql(
      `alter table cash_tables
       add column if not exists squid_target int not null default 3`,
    );
    await sql(
      `alter table cash_tables
       add column if not exists cucurucho_enabled boolean not null default false`,
    );
    await sql(
      `alter table cash_tables
       add column if not exists cucurucho_ante_bb numeric(12,2) not null default 5`,
    );
    await sql(
      `alter table cash_tables
       add column if not exists cucurucho_every_hands int not null default 1`,
    );
  });
}
