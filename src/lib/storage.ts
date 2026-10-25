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
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** In-memory storage, optionally mirrored to localStorage. Used for tests and the browser preview. */
export class MemoryStorage implements Storage {
  private lib: Library = { bookmarks: [], categories: [], tags: [] };
  private settings: Record<string, string> = {};

  constructor(private readonly persistKey?: string) {
    if (persistKey && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(persistKey);
        if (raw) ({ lib: this.lib, settings: this.settings } = JSON.parse(raw));
      } catch {
        // Ignore unreadable preview data; start empty.
      }
    }
  }

  private persist() {
    if (!this.persistKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.persistKey, JSON.stringify({ lib: this.lib, settings: this.settings }));
    } catch {
      // Storage full or blocked; the preview keeps working in memory.
    }
  }

  private upsert<T extends { id: string }>(list: T[], items: T[]): T[] {
    const byId = new Map(list.map((x) => [x.id, x]));
    for (const item of items) byId.set(item.id, structuredClone(item));
    return [...byId.values()];
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
  private constructor(private readonly db: SqlDb) {}

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
