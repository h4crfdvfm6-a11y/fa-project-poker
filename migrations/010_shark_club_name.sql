-- Rename the default club to the new brand (only if it still has the old default name).
update clubs set name = 'Shark Club' where name = 'FA Poker Club';
