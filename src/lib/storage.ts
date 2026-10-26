import { sectionFor, type Link, type LinkLibrary } from './link-types';
import type { RssFeed, RssItem, RssLibrary } from './rss-types';
import type { Bookmark, Category, Library, Tag } from './types';

/** Where the library is persisted. The app keeps the whole library in memory and writes through. */
export interface Storage {
  load(): Promise<Library>;
  saveBookmarks(bookmarks: Bookmark[]): Promise<void>;
  deleteBookmarks(ids: string[]): Promise<void>;
  saveCategories(categories: Category[]): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  saveTags(tags: Tag[]): Promise<void>;
  deleteTags(ids: string[]): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  /** Removes everything (used by "Replace my library" import). */
  clear(): Promise<void>;
  /** The link library, kept apart from the YouTube one (its own categories and tags). */
  links: LinkStorage;
  /** Feeds and their articles for the RSS tab. */
  rss: RssStorage;
}

export interface RssStorage {
  load(): Promise<RssLibrary>;
  saveFeeds(feeds: RssFeed[]): Promise<void>;
  /** Removes the feeds and their articles. */
  deleteFeeds(ids: string[]): Promise<void>;
  saveItems(items: RssItem[]): Promise<void>;
  deleteItems(ids: string[]): Promise<void>;
}

export interface LinkStorage {
  load(): Promise<LinkLibrary>;
  saveLinks(links: Link[]): Promise<void>;
  deleteLinks(ids: string[]): Promise<void>;
  saveCategories(categories: Category[]): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  saveTags(tags: Tag[]): Promise<void>;
  deleteTags(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** In-memory storage, optionally mirrored to localStorage. Used for tests and the browser preview. */
function upsert<T extends { id: string }>(list: T[], items: T[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  for (const item of items) byId.set(item.id, structuredClone(item));
  return [...byId.values()];
}

export class MemoryStorage implements Storage {
  private lib: Library = { bookmarks: [], categories: [], tags: [] };
  private linkLib: LinkLibrary = { links: [], categories: [], tags: [] };
  private rssLib: RssLibrary = { feeds: [], items: [] };
  private settings: Record<string, string> = {};
  readonly links: LinkStorage;
  readonly rss: RssStorage;

  constructor(private readonly persistKey?: string) {
    if (persistKey && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(persistKey);
        if (raw) {
          const saved = JSON.parse(raw);
          this.lib = saved.lib;
          this.settings = saved.settings;
          this.linkLib = saved.linkLib ?? this.linkLib;
          this.rssLib = saved.rssLib ?? this.rssLib;
          // Preview data from before tabs and manual groups.
          this.linkLib.links = this.linkLib.links.map((l) => ({ ...l, section: l.section ?? sectionFor(l.domain), groupName: l.groupName ?? null }));
        }
      } catch {
        // Ignore unreadable preview data; start empty.
      }
    }
    this.links = this.makeLinkStorage();
    this.rss = this.makeRssStorage();
  }

  private persist() {
    if (!this.persistKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.persistKey, JSON.stringify({ lib: this.lib, settings: this.settings, linkLib: this.linkLib, rssLib: this.rssLib }));
    } catch {
      // Storage full or blocked; the preview keeps working in memory.
    }
  }

  private upsert<T extends { id: string }>(list: T[], items: T[]): T[] {
    return upsert(list, items);
  }

  private makeRssStorage(): RssStorage {
    const self = this;
    return {
      async load() {
        return structuredClone(self.rssLib);
      },
      async saveFeeds(feeds) {
        self.rssLib.feeds = upsert(self.rssLib.feeds, feeds);
        self.persist();
      },
      async deleteFeeds(ids) {
        const drop = new Set(ids);
        self.rssLib.feeds = self.rssLib.feeds.filter((f) => !drop.has(f.id));
        self.rssLib.items = self.rssLib.items.filter((i) => !drop.has(i.feedId));
        self.persist();
      },
      async saveItems(items) {
        self.rssLib.items = upsert(self.rssLib.items, items);
        self.persist();
      },
      async deleteItems(ids) {
        const drop = new Set(ids);
        self.rssLib.items = self.rssLib.items.filter((i) => !drop.has(i.id));
        self.persist();
      },
    };
  }

  private makeLinkStorage(): LinkStorage {
    const self = this;
    return {
      async load() {
        return structuredClone(self.linkLib);
      },
      async saveLinks(links) {
        const keys = new Map(self.linkLib.links.map((l) => [l.dedupeKey, l.id]));
        for (const l of links) {
          const owner = keys.get(l.dedupeKey);
          if (owner && owner !== l.id) throw new Error(`UNIQUE constraint failed: links.dedupe_key (${l.dedupeKey})`);
        }
        self.linkLib.links = upsert(self.linkLib.links, links);
        self.persist();
      },
      async deleteLinks(ids) {
        const drop = new Set(ids);
        self.linkLib.links = self.linkLib.links.filter((l) => !drop.has(l.id));
        self.persist();
      },
      async saveCategories(categories) {
        self.linkLib.categories = upsert(self.linkLib.categories, categories);
        self.persist();
      },
      async deleteCategory(id) {
        self.linkLib.categories = self.linkLib.categories.filter((c) => c.id !== id);
        self.linkLib.links = self.linkLib.links.map((l) => (l.categoryId === id ? { ...l, categoryId: null } : l));
        self.persist();
      },
      async saveTags(tags) {
        self.linkLib.tags = upsert(self.linkLib.tags, tags);
        self.persist();
      },
      async deleteTags(ids) {
        const drop = new Set(ids);
        self.linkLib.tags = self.linkLib.tags.filter((t) => !drop.has(t.id));
        self.linkLib.links = self.linkLib.links.map((l) => ({ ...l, tagIds: l.tagIds.filter((t) => !drop.has(t)) }));
        self.persist();
      },
      async clear() {
        self.linkLib = { links: [], categories: [], tags: [] };
        self.persist();
      },
    };
  }

  async load(): Promise<Library> {
    return structuredClone(this.lib);
  }
  async saveBookmarks(bookmarks: Bookmark[]) {
    const keys = new Map(this.lib.bookmarks.map((b) => [b.dedupeKey, b.id]));
    for (const b of bookmarks) {
      const owner = keys.get(b.dedupeKey);
      if (owner && owner !== b.id) throw new Error(`UNIQUE constraint failed: bookmarks.dedupe_key (${b.dedupeKey})`);
    }
    this.lib.bookmarks = this.upsert(this.lib.bookmarks, bookmarks);
    this.persist();
  }
  async deleteBookmarks(ids: string[]) {
    const drop = new Set(ids);
    this.lib.bookmarks = this.lib.bookmarks.filter((b) => !drop.has(b.id));
    this.persist();
  }
  async saveCategories(categories: Category[]) {
    this.lib.categories = this.upsert(this.lib.categories, categories);
    this.persist();
  }
  async deleteCategory(id: string) {
    this.lib.categories = this.lib.categories.filter((c) => c.id !== id);
    this.lib.bookmarks = this.lib.bookmarks.map((b) => (b.categoryId === id ? { ...b, categoryId: null } : b));
    this.persist();
  }
  async saveTags(tags: Tag[]) {
    this.lib.tags = this.upsert(this.lib.tags, tags);
    this.persist();
  }
  async deleteTags(ids: string[]) {
    const drop = new Set(ids);
    this.lib.tags = this.lib.tags.filter((t) => !drop.has(t.id));
    this.lib.bookmarks = this.lib.bookmarks.map((b) => ({ ...b, tagIds: b.tagIds.filter((t) => !drop.has(t)) }));
    this.persist();
  }
  async getSetting(key: string) {
    return this.settings[key] ?? null;
  }
  async setSetting(key: string, value: string) {
    this.settings[key] = value;
    this.persist();
  }
  async clear() {
    this.lib = { bookmarks: [], categories: [], tags: [] };
    this.persist();
  }
}

type Row = Record<string, any>;
interface SqlDb {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}

const BOOKMARK_COLUMNS = [
  'id', 'url', 'type', 'youtube_id', 'dedupe_key', 'title', 'description', 'thumbnail_url', 'channel_name', 'channel_url',
  'category_id', 'duration_sec', 'published_at', 'view_count', 'item_count', 'notes', 'watched',
  'created_at', 'updated_at', 'metadata_status',
] as const;

function bookmarkValues(b: Bookmark): unknown[] {
  return [
    b.id, b.url, b.type, b.youtubeId, b.dedupeKey, b.title, b.description, b.thumbnailUrl, b.channelName, b.channelUrl,
    b.categoryId, b.durationSec, b.publishedAt, b.viewCount, b.itemCount, b.notes, b.watched ? 1 : 0,
    b.createdAt, b.updatedAt, b.metadataStatus,
  ];
}

function placeholders(rows: number, cols: number): string {
  let n = 0;
  return Array.from({ length: rows }, () => `(${Array.from({ length: cols }, () => `$${++n}`).join(', ')})`).join(', ');
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** SQLite storage through tauri-plugin-sql. The schema lives in src-tauri/migrations. */
export class SqliteStorage implements Storage {
  readonly links: LinkStorage;
  readonly rss: RssStorage;
  private constructor(private readonly db: SqlDb) {
    this.links = new SqliteLinkStorage(db);
    this.rss = new SqliteRssStorage(db);
  }

  static async open(): Promise<SqliteStorage> {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const db = await Database.load('sqlite:tubemarks.db');
    return new SqliteStorage(db);
  }

  async load(): Promise<Library> {
    const [rows, links, categories, tags] = await Promise.all([
      this.db.select<Row[]>('SELECT * FROM bookmarks'),
      this.db.select<Row[]>('SELECT bookmark_id, tag_id FROM bookmark_tags'),
      this.db.select<Row[]>('SELECT * FROM categories ORDER BY name'),
      this.db.select<Row[]>('SELECT * FROM tags ORDER BY name'),
    ]);
    const tagsOf = new Map<string, string[]>();
    for (const l of links) tagsOf.set(l.bookmark_id, [...(tagsOf.get(l.bookmark_id) ?? []), l.tag_id]);
    return {
      bookmarks: rows.map((r) => ({
        id: r.id,
        url: r.url,
        type: r.type,
        youtubeId: r.youtube_id,
        dedupeKey: r.dedupe_key,
        title: r.title,
        description: r.description,
        thumbnailUrl: r.thumbnail_url,
        channelName: r.channel_name,
        channelUrl: r.channel_url ?? '',
        categoryId: r.category_id,
        tagIds: tagsOf.get(r.id) ?? [],
        durationSec: r.duration_sec,
        publishedAt: r.published_at,
        viewCount: r.view_count,
        itemCount: r.item_count,
        notes: r.notes,
        watched: !!r.watched,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        metadataStatus: r.metadata_status,
        section: r.section ?? 'links',
        groupName: r.group_name ?? null,
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name, color: c.color, createdAt: c.created_at })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, createdAt: t.created_at })),
    };
  }

  async saveBookmarks(bookmarks: Bookmark[]) {
    const cols = BOOKMARK_COLUMNS.length;
    const updates = BOOKMARK_COLUMNS.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `${c} = excluded.${c}`).join(', ');
    // SQLite allows 999 bound parameters per statement in older builds; 40 rows × 20 columns stays under it.
    for (const batch of chunk(bookmarks, 40)) {
      await this.db.execute(
        `INSERT INTO bookmarks (${BOOKMARK_COLUMNS.join(', ')}) VALUES ${placeholders(batch.length, cols)}
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        batch.flatMap(bookmarkValues),
      );
      const ids = batch.map((b) => b.id);
      await this.db.execute(`DELETE FROM bookmark_tags WHERE bookmark_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})`, ids);
      const links = batch.flatMap((b) => b.tagIds.map((t) => [b.id, t]));
      for (const linkBatch of chunk(links, 400)) {
        await this.db.execute(`INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES ${placeholders(linkBatch.length, 2)}`, linkBatch.flat());
      }
    }
  }

  async deleteBookmarks(ids: string[]) {
    for (const batch of chunk(ids, 400)) {
      const ph = batch.map((_, i) => `$${i + 1}`).join(', ');
      await this.db.execute(`DELETE FROM bookmark_tags WHERE bookmark_id IN (${ph})`, batch);
      await this.db.execute(`DELETE FROM bookmarks WHERE id IN (${ph})`, batch);
    }
  }

  async saveCategories(categories: Category[]) {
    for (const c of categories) {
      await this.db.execute(
        `INSERT INTO categories (id, name, color, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
        [c.id, c.name, c.color, c.createdAt],
      );
    }
  }

  async deleteCategory(id: string) {
    await this.db.execute('UPDATE bookmarks SET category_id = NULL WHERE category_id = $1', [id]);
    await this.db.execute('DELETE FROM categories WHERE id = $1', [id]);
  }

  async saveTags(tags: Tag[]) {
    for (const t of tags) {
      await this.db.execute(
        'INSERT INTO tags (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT(id) DO UPDATE SET name = excluded.name',
        [t.id, t.name, t.createdAt],
      );
    }
  }

  async deleteTags(ids: string[]) {
    for (const batch of chunk(ids, 400)) {
      const ph = batch.map((_, i) => `$${i + 1}`).join(', ');
      await this.db.execute(`DELETE FROM bookmark_tags WHERE tag_id IN (${ph})`, batch);
      await this.db.execute(`DELETE FROM tags WHERE id IN (${ph})`, batch);
    }
  }

  async getSetting(key: string) {
    const rows = await this.db.select<Row[]>('SELECT value FROM settings WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string) {
    await this.db.execute('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }

  async clear() {
    await this.db.execute('DELETE FROM bookmark_tags');
    await this.db.execute('DELETE FROM bookmarks');
    await this.db.execute('DELETE FROM tags');
    await this.db.execute('DELETE FROM categories');
  }
}

const LINK_COLUMNS = [
  'id', 'url', 'dedupe_key', 'domain', 'title', 'description', 'favicon_url', 'image_url', 'site_name', 'category_id',
  'notes', 'viewed', 'flags', 'open_count', 'last_opened_at', 'quick_launch', 'created_at', 'updated_at', 'metadata_status',
  'section', 'group_name',
] as const;

function linkValues(l: Link): unknown[] {
  return [
    l.id, l.url, l.dedupeKey, l.domain, l.title, l.description, l.faviconUrl, l.imageUrl, l.siteName, l.categoryId,
    l.notes, l.viewed ? 1 : 0, l.flags.join(','), l.openCount, l.lastOpenedAt, l.quickLaunch, l.createdAt, l.updatedAt, l.metadataStatus,
    l.section, l.groupName,
  ];
}

/** The link library's tables (migration 0003). */
class SqliteLinkStorage implements LinkStorage {
  constructor(private readonly db: SqlDb) {}

  async load(): Promise<LinkLibrary> {
    const [rows, map, categories, tags] = await Promise.all([
      this.db.select<Row[]>('SELECT * FROM links'),
      this.db.select<Row[]>('SELECT link_id, tag_id FROM link_tag_map'),
      this.db.select<Row[]>('SELECT * FROM link_categories ORDER BY name'),
      this.db.select<Row[]>('SELECT * FROM link_tags ORDER BY name'),
    ]);
    const tagsOf = new Map<string, string[]>();
    for (const m of map) {
      const list = tagsOf.get(m.link_id);
      if (list) list.push(m.tag_id);
      else tagsOf.set(m.link_id, [m.tag_id]);
    }
    return {
      links: rows.map((r) => ({
        id: r.id,
        url: r.url,
        dedupeKey: r.dedupe_key,
        domain: r.domain,
        title: r.title,
        description: r.description,
        faviconUrl: r.favicon_url,
        imageUrl: r.image_url,
        siteName: r.site_name,
        categoryId: r.category_id,
        tagIds: tagsOf.get(r.id) ?? [],
        notes: r.notes,
        viewed: !!r.viewed,
        flags: r.flags ? r.flags.split(',') : [],
        openCount: r.open_count,
        lastOpenedAt: r.last_opened_at,
        quickLaunch: r.quick_launch,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        metadataStatus: r.metadata_status,
        section: r.section ?? 'links',
        groupName: r.group_name ?? null,
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name, color: c.color, createdAt: c.created_at })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, createdAt: t.created_at })),
    };
  }

  async saveLinks(links: Link[]) {
    const updates = LINK_COLUMNS.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `${c} = excluded.${c}`).join(', ');
    // 40 rows × 21 columns stays under SQLite's 999-parameter limit.
    for (const batch of chunk(links, 40)) {
      await this.db.execute(
        `INSERT INTO links (${LINK_COLUMNS.join(', ')}) VALUES ${placeholders(batch.length, LINK_COLUMNS.length)}
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        batch.flatMap(linkValues),
      );
      const ids = batch.map((l) => l.id);
      await this.db.execute(`DELETE FROM link_tag_map WHERE link_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})`, ids);
      const pairs = batch.flatMap((l) => l.tagIds.map((t) => [l.id, t]));
      for (const part of chunk(pairs, 400)) {
        await this.db.execute(`INSERT OR IGNORE INTO link_tag_map (link_id, tag_id) VALUES ${placeholders(part.length, 2)}`, part.flat());
      }
    }
  }

  async deleteLinks(ids: string[]) {
    for (const batch of chunk(ids, 400)) {
      const ph = batch.map((_, i) => `$${i + 1}`).join(', ');
      await this.db.execute(`DELETE FROM link_tag_map WHERE link_id IN (${ph})`, batch);
      await this.db.execute(`DELETE FROM links WHERE id IN (${ph})`, batch);
    }
  }

  async saveCategories(categories: Category[]) {
    for (const c of categories) {
      await this.db.execute(
        `INSERT INTO link_categories (id, name, color, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
        [c.id, c.name, c.color, c.createdAt],
      );
    }
  }

  async deleteCategory(id: string) {
    await this.db.execute('UPDATE links SET category_id = NULL WHERE category_id = $1', [id]);
    await this.db.execute('DELETE FROM link_categories WHERE id = $1', [id]);
  }

  async saveTags(tags: Tag[]) {
    for (const t of tags) {
      await this.db.execute(
        'INSERT INTO link_tags (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT(id) DO UPDATE SET name = excluded.name',
        [t.id, t.name, t.createdAt],
      );
    }
  }

  async deleteTags(ids: string[]) {
    for (const batch of chunk(ids, 400)) {
      const ph = batch.map((_, i) => `$${i + 1}`).join(', ');
      await this.db.execute(`DELETE FROM link_tag_map WHERE tag_id IN (${ph})`, batch);
      await this.db.execute(`DELETE FROM link_tags WHERE id IN (${ph})`, batch);
    }
  }

  async clear() {
    await this.db.execute('DELETE FROM link_tag_map');
    await this.db.execute('DELETE FROM links');
    await this.db.execute('DELETE FROM link_tags');
    await this.db.execute('DELETE FROM link_categories');
  }
}

const FEED_COLUMNS = ['id', 'url', 'title', 'site_url', 'description', 'folder', 'last_fetched_at', 'last_error', 'created_at'] as const;
const ITEM_COLUMNS = ['id', 'feed_id', 'guid', 'title', 'url', 'summary', 'author', 'published_at', 'image_url', 'read', 'starred', 'fetched_at'] as const;

/** The RSS tab's tables (migration 0005). */
class SqliteRssStorage implements RssStorage {
  constructor(private readonly db: SqlDb) {}

  async load(): Promise<RssLibrary> {
    const [feeds, items] = await Promise.all([
      this.db.select<Row[]>('SELECT * FROM rss_feeds'),
      this.db.select<Row[]>('SELECT * FROM rss_items'),
    ]);
    return {
      feeds: feeds.map((r) => ({
        id: r.id,
        url: r.url,
        title: r.title,
        siteUrl: r.site_url,
        description: r.description,
        folder: r.folder,
        lastFetchedAt: r.last_fetched_at,
        lastError: r.last_error,
        createdAt: r.created_at,
      })),
      items: items.map((r) => ({
        id: r.id,
        feedId: r.feed_id,
        guid: r.guid,
        title: r.title,
        url: r.url,
        summary: r.summary,
        author: r.author,
        publishedAt: r.published_at,
        imageUrl: r.image_url,
        read: !!r.read,
        starred: !!r.starred,
        fetchedAt: r.fetched_at,
      })),
    };
  }

  async saveFeeds(feeds: RssFeed[]) {
    const updates = FEED_COLUMNS.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `${c} = excluded.${c}`).join(', ');
    for (const batch of chunk(feeds, 80)) {
      await this.db.execute(
        `INSERT INTO rss_feeds (${FEED_COLUMNS.join(', ')}) VALUES ${placeholders(batch.length, FEED_COLUMNS.length)} ON CONFLICT(id) DO UPDATE SET ${updates}`,
        batch.flatMap((f) => [f.id, f.url, f.title, f.siteUrl, f.description, f.folder, f.lastFetchedAt, f.lastError, f.createdAt]),
      );
    }
  }

  async deleteFeeds(ids: string[]) {
    for (const batch of chunk(ids, 400)) {
      const ph = batch.map((_, i) => `$${i + 1}`).join(', ');
      await this.db.execute(`DELETE FROM rss_items WHERE feed_id IN (${ph})`, batch);
      await this.db.execute(`DELETE FROM rss_feeds WHERE id IN (${ph})`, batch);
    }
  }

  async saveItems(items: RssItem[]) {
    const updates = ITEM_COLUMNS.filter((c) => c !== 'id' && c !== 'fetched_at').map((c) => `${c} = excluded.${c}`).join(', ');
    // 60 rows × 12 columns stays under SQLite's 999-parameter limit.
    for (const batch of chunk(items, 60)) {
      await this.db.execute(
        `INSERT INTO rss_items (${ITEM_COLUMNS.join(', ')}) VALUES ${placeholders(batch.length, ITEM_COLUMNS.length)} ON CONFLICT(id) DO UPDATE SET ${updates}`,
        batch.flatMap((i) => [i.id, i.feedId, i.guid, i.title, i.url, i.summary, i.author, i.publishedAt, i.imageUrl, i.read ? 1 : 0, i.starred ? 1 : 0, i.fetchedAt]),
      );
    }
  }

  async deleteItems(ids: string[]) {
    for (const batch of chunk(ids, 400)) {
      await this.db.execute(`DELETE FROM rss_items WHERE id IN (${batch.map((_, i) => `$${i + 1}`).join(', ')})`, batch);
    }
  }
}
