-- Add freestyle_chess to allowed game types
-- Note: Modifying a check constraint in PostgreSQL usually requires dropping and recreating it.

-- 1. GAMES TABLE
alter table games drop constraint games_game_type_check;
alter table games add constraint games_game_type_check 
  check (game_type in ('chess', 'tictactoe', 'rps', 'freestyle_chess'));

-- 2. GAME INVITES TABLE
alter table game_invites drop constraint game_invites_game_type_check;
alter table game_invites add constraint game_invites_game_type_check 
  check (game_type in ('chess', 'tictactoe', 'rps', 'freestyle_chess'));
