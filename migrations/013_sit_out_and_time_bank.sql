-- Sit out next hand: when the player sat out (cash tables remove them after
-- 15 minutes, All-in or Fold tables after 7).
alter table table_seats add column if not exists sat_out_at timestamptz;

-- Free Time Bank cards (+10 s each, used automatically when the base time
-- runs out). Start with 5, earn 1 every 25 hands played, hold at most 12.
create table if not exists member_time_bank (
  member_id text primary key,
  cards integer not null default 5,
  hands_since integer not null default 0,
  updated_at timestamptz not null default now()
);

-- The time bank card used for the decision in progress (one per decision).
create table if not exists action_clock (
  table_id text primary key,
  decision_key text not null,
  bank_ms integer not null default 0
);
