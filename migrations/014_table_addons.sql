-- Add chips at the table (cash games): the request waits here and is added to
-- the player's stack before the next deal (never in the middle of a hand).
create table if not exists table_addons (
  table_id text not null,
  member_id text not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  primary key (table_id, member_id)
);
