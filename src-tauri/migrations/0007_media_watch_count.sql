-- How many times a movie or show was watched (rewatches count).
ALTER TABLE media_items ADD COLUMN watch_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_items ADD COLUMN last_watched_at TEXT;
UPDATE media_items SET watch_count = 1 WHERE status = 'watched';
