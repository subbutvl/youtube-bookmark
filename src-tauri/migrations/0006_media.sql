-- Movies and TV shows. Genres, links and where-to-watch are JSON lists; links here never go to the links table.
CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  original_title TEXT NOT NULL DEFAULT '',
  year INTEGER,
  language TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  poster_url TEXT NOT NULL DEFAULT '',
  imdb_id TEXT NOT NULL DEFAULT '',
  imdb_rating REAL,
  imdb_votes INTEGER,
  rt_score INTEGER,
  genres TEXT NOT NULL DEFAULT '[]',
  runtime INTEGER,
  seasons INTEGER,
  trailer_id TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '[]',
  watch TEXT NOT NULL DEFAULT '[]',
  justwatch_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'none',
  my_rating REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  fetched_at TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS media_items_kind ON media_items(kind);
