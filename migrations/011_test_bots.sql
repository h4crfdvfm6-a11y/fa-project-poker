-- Test mode: bots fill the cash tables so there's always a full table to play.
-- bot_hold_until keeps one seat free while a person is joining.
alter table cash_tables add column if not exists bot_hold_until timestamptz;
-- Full 9-seat ring tables for testing.
update cash_tables set seats = 9 where format <> 'tournament' and status = 'open' and seats < 9;
