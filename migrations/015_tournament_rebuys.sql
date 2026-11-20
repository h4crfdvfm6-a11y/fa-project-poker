-- Existing tournaments remain freezeouts. Rebuys use the original buy-in/fee
-- and starting stack, through the last level selected by the administrator.
alter table tournaments add column if not exists rebuy_until_level int not null default 0;
alter table table_seats add column if not exists rebuy_hand_no int not null default -1;
alter table table_seats add column if not exists rebuy_deadline timestamptz;
alter table table_runtime add column if not exists settled_hand_no int not null default -1;
-- Hands completed before this upgrade are already settled.
update table_runtime set settled_hand_no = hand_no where phase = 'showdown';
create table if not exists tournament_rebuys (
  tournament_id text not null references tournaments(id),
  member_id text not null references members(id),
  hand_no int not null,
  created_at timestamptz not null default now(),
  primary key (tournament_id, member_id, hand_no)
);
