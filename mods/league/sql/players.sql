CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id TEXT,
  pkey TEXT,
  email TEXT,
  score INTEGER,
  games_started INTEGER DEFAULT 0,
  games_finished INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_tied INTEGER DEFAULT 0,
  ts INTEGER,
  UNIQUE (league_id, pkey)
);
