-- 011 missed tables whose format is empty: make every open ring table 9 seats for testing.
update cash_tables set seats = 9
where coalesce(format, 'ring') <> 'tournament' and status = 'open' and seats < 9;
