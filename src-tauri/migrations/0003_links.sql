-- Link bookmarks: ordinary web pages, kept apart from the YouTube library.
CREATE TABLE IF NOT EXISTS link_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  favicon_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  site_name TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES link_categories(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  viewed INTEGER NOT NULL DEFAULT 0,
  -- Comma-separated manual flags: trending, later, must.
  flags TEXT NOT NULL DEFAULT '',
  open_count INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT,
  -- Position in the quick launch bar, or NULL when not pinned.
  quick_launch INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS links_domain ON links(domain);
CREATE INDEX IF NOT EXISTS links_created ON links(created_at);

CREATE TABLE IF NOT EXISTS link_tag_map (
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES link_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, tag_id)
);
