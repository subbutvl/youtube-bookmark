-- Links split into tabs (Links, Git, Wikipedia) and can be grouped by hand.
ALTER TABLE links ADD COLUMN section TEXT NOT NULL DEFAULT 'links';
ALTER TABLE links ADD COLUMN group_name TEXT;

-- Existing repository and Wikipedia links move to their own tabs.
UPDATE links SET section = 'git'
  WHERE domain IN ('github.com', 'gist.github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org', 'sourceforge.net', 'git.sr.ht');
UPDATE links SET section = 'wiki'
  WHERE domain = 'wikipedia.org' OR domain LIKE '%.wikipedia.org';

CREATE INDEX IF NOT EXISTS links_section ON links(section);
