-- Feeds the RSS tab follows, and the articles read from them.
CREATE TABLE IF NOT EXISTS rss_feeds (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  site_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT '',
  last_fetched_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rss_items (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  image_url TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL,
  UNIQUE (feed_id, guid)
);

CREATE INDEX IF NOT EXISTS rss_items_feed ON rss_items(feed_id);
