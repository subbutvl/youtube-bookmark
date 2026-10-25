import type { ImportItem } from './backup';
import type { Storage } from './storage';
import { CATEGORY_COLORS, type Bookmark, type Category, type Library, type Tag } from './types';
import { YouTubeApi, type FetchedMetadata } from './youtube-api';
import { instantThumbnail, parseYouTubeUrl, splitUrls } from './youtube-url';

export const API_KEY_SETTING = 'youtubeApiKey';

export interface AddResult {
  added: Bookmark[];
  /** Links already in the library (or repeated in the same paste); never stored again. */
  duplicates: { input: string; existing: Bookmark }[];
  invalid: string[];
  /** Real playlists found inside watch URLs, offered as "Also save the playlist?". */
  playlistOffers: string[];
}

export interface ImportResult {
  added: number;
  duplicates: number;
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/**
 * The in-memory library plus every operation the UI performs. Each change is
 * written through to storage, then listeners are notified with a new snapshot.
 */
export class LibraryStore {
  private lib: Library = { bookmarks: [], categories: [], tags: [] };
  private listeners = new Set<() => void>();
  private apiKey = '';
  private fetching = new Set<string>();

  constructor(
    private readonly storage: Storage,
    private readonly makeApi: (key: string) => YouTubeApi = (key) => new YouTubeApi(key),
    private readonly envApiKey = '',
  ) {}

  async init() {
    this.lib = await this.storage.load();
    this.apiKey = (await this.storage.getSetting(API_KEY_SETTING)) || this.envApiKey;
    this.emit();
  }

  // ----- subscription (for React's useSyncExternalStore) -----

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.lib;
  private emit() {
    this.lib = { ...this.lib };
    for (const fn of this.listeners) fn();
  }

  get hasApiKey() {
    return !!this.apiKey;
  }
  get apiKeySource(): 'settings' | 'env' | 'none' {
    return !this.apiKey ? 'none' : this.apiKey === this.envApiKey ? 'env' : 'settings';
  }
  isFetching(id: string) {
    return this.fetching.has(id);
  }

  async setApiKey(key: string) {
    await this.storage.setSetting(API_KEY_SETTING, key.trim());
    this.apiKey = key.trim() || this.envApiKey;
    this.emit();
  }

  async verifyApiKey(key: string) {
    await this.makeApi(key.trim()).verifyKey();
  }

  findByKey(dedupeKey: string): Bookmark | undefined {
    return this.lib.bookmarks.find((b) => b.dedupeKey === dedupeKey);
  }

  // ----- categories and tags -----

  private async ensureCategory(name: string): Promise<Category> {
    const existing = this.lib.categories.find((c) => sameName(c.name, name));
    if (existing) return existing;
    const c: Category = { id: uid(), name: name.trim(), color: CATEGORY_COLORS[this.lib.categories.length % CATEGORY_COLORS.length], createdAt: now() };
    await this.storage.saveCategories([c]);
    this.lib.categories = [...this.lib.categories, c];
    return c;
  }

  private async ensureTags(names: string[]): Promise<Tag[]> {
    const out: Tag[] = [];
    const created: Tag[] = [];
    for (const raw of names) {
      const name = raw.trim().replace(/^#/, '');
      if (!name) continue;
      let t = this.lib.tags.find((x) => sameName(x.name, name)) ?? created.find((x) => sameName(x.name, name));
      if (!t) {
        t = { id: uid(), name, createdAt: now() };
        created.push(t);
      }
      if (!out.includes(t)) out.push(t);
    }
    if (created.length) {
      await this.storage.saveTags(created);
      this.lib.tags = [...this.lib.tags, ...created];
    }
    return out;
  }

  async addCategory(name: string, color?: string) {
    const c = await this.ensureCategory(name);
    if (color && c.color !== color) await this.updateCategory(c.id, { color });
    this.emit();
    return c;
  }

  async updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>) {
    const c = this.lib.categories.find((x) => x.id === id);
    if (!c) return;
    if (patch.name && this.lib.categories.some((x) => x.id !== id && sameName(x.name, patch.name!))) {
      throw new Error(`A category called "${patch.name}" already exists. Use Merge instead.`);
    }
    const next = { ...c, ...patch, name: (patch.name ?? c.name).trim() };
    await this.storage.saveCategories([next]);
    this.lib.categories = this.lib.categories.map((x) => (x.id === id ? next : x));
    this.emit();
  }

  /** Moves every bookmark in `fromId` to `toId`, then deletes `fromId`. */
  async mergeCategory(fromId: string, toId: string) {
    const moved = this.lib.bookmarks.filter((b) => b.categoryId === fromId).map((b) => ({ ...b, categoryId: toId, updatedAt: now() }));
    await this.storage.saveBookmarks(moved);
    this.replaceBookmarks(moved);
    await this.deleteCategory(fromId);
  }

  /** Bookmarks in the category become Uncategorized. */
  async deleteCategory(id: string) {
    await this.storage.deleteCategory(id);
    this.lib.categories = this.lib.categories.filter((c) => c.id !== id);
    this.lib.bookmarks = this.lib.bookmarks.map((b) => (b.categoryId === id ? { ...b, categoryId: null } : b));
    this.emit();
  }

  async addTag(name: string) {
    const [t] = await this.ensureTags([name]);
    this.emit();
    return t;
  }

  /** Renaming a tag to an existing tag's name merges the two. */
  async renameTag(id: string, name: string) {
    const target = this.lib.tags.find((t) => t.id !== id && sameName(t.name, name));
    if (target) return this.mergeTags([id], target.id);
    const t = this.lib.tags.find((x) => x.id === id);
    if (!t) return;
    const next = { ...t, name: name.trim().replace(/^#/, '') };
    await this.storage.saveTags([next]);
    this.lib.tags = this.lib.tags.map((x) => (x.id === id ? next : x));
    this.emit();
  }

  async mergeTags(fromIds: string[], toId: string) {
    const from = new Set(fromIds.filter((id) => id !== toId));
    const changed = this.lib.bookmarks
      .filter((b) => b.tagIds.some((t) => from.has(t)))
      .map((b) => ({ ...b, tagIds: [...new Set(b.tagIds.map((t) => (from.has(t) ? toId : t)))], updatedAt: now() }));
    await this.storage.saveBookmarks(changed);
    this.replaceBookmarks(changed);
    await this.deleteTags([...from]);
  }

  async deleteTags(ids: string[]) {
    const drop = new Set(ids);
    await this.storage.deleteTags(ids);
    this.lib.tags = this.lib.tags.filter((t) => !drop.has(t.id));
    this.lib.bookmarks = this.lib.bookmarks.map((b) => (b.tagIds.some((t) => drop.has(t)) ? { ...b, tagIds: b.tagIds.filter((t) => !drop.has(t)) } : b));
    this.emit();
  }

  // ----- bookmarks -----

  private replaceBookmarks(changed: Bookmark[]) {
    const byId = new Map(changed.map((b) => [b.id, b]));
    this.lib.bookmarks = this.lib.bookmarks.map((b) => byId.get(b.id) ?? b);
  }

  /**
   * Adds every YouTube link in `text`. Links already saved are reported as
   * duplicates and not stored again. Metadata is fetched in the background.
   */
  async addUrls(text: string, opts: { categoryId?: string | null; tagNames?: string[] } = {}): Promise<AddResult> {
    const result: AddResult = { added: [], duplicates: [], invalid: [], playlistOffers: [] };
    const tags = opts.tagNames?.length ? await this.ensureTags(opts.tagNames) : [];
    const batch = new Map<string, Bookmark>();
    for (const input of splitUrls(text)) {
      const p = parseYouTubeUrl(input);
      if (!p) {
        result.invalid.push(input);
        continue;
      }
      const existing = this.findByKey(p.dedupeKey) ?? batch.get(p.dedupeKey);
      if (existing) {
        result.duplicates.push({ input, existing });
        continue;
      }
      if (p.playlistId && !this.findByKey(`playlist:${p.playlistId}`)) result.playlistOffers.push(p.playlistId);
      const t = now();
      batch.set(p.dedupeKey, {
        id: uid(),
        url: p.url,
        type: p.type,
        youtubeId: p.youtubeId,
        dedupeKey: p.dedupeKey,
        title: '',
        description: '',
        thumbnailUrl: instantThumbnail(p.type, p.youtubeId),
        channelName: '',
        categoryId: opts.categoryId ?? null,
        tagIds: tags.map((x) => x.id),
        durationSec: null,
        publishedAt: null,
        viewCount: null,
        itemCount: null,
        notes: '',
        watched: false,
        createdAt: t,
        updatedAt: t,
        metadataStatus: 'pending',
      });
    }
    result.added = [...batch.values()];
    if (result.added.length) {
      await this.storage.saveBookmarks(result.added);
      this.lib.bookmarks = [...this.lib.bookmarks, ...result.added];
    }
    this.emit();
    if (result.added.length) void this.refreshMetadata(result.added.map((b) => b.id));
    return result;
  }

  async updateBookmark(id: string, patch: Partial<Omit<Bookmark, 'id' | 'dedupeKey' | 'createdAt'>>, tagNames?: string[]) {
    const b = this.lib.bookmarks.find((x) => x.id === id);
    if (!b) return;
    const tagIds = tagNames ? (await this.ensureTags(tagNames)).map((t) => t.id) : patch.tagIds ?? b.tagIds;
    const next: Bookmark = { ...b, ...patch, tagIds, updatedAt: now() };
    await this.storage.saveBookmarks([next]);
    this.replaceBookmarks([next]);
    this.emit();
  }

  async setWatched(ids: string[], watched: boolean) {
    const set = new Set(ids);
    const changed = this.lib.bookmarks.filter((b) => set.has(b.id) && b.watched !== watched).map((b) => ({ ...b, watched, updatedAt: now() }));
    await this.storage.saveBookmarks(changed);
    this.replaceBookmarks(changed);
    this.emit();
  }

  async setCategory(ids: string[], categoryId: string | null) {
    const set = new Set(ids);
    const changed = this.lib.bookmarks.filter((b) => set.has(b.id)).map((b) => ({ ...b, categoryId, updatedAt: now() }));
    await this.storage.saveBookmarks(changed);
    this.replaceBookmarks(changed);
    this.emit();
  }

  async addTagToMany(ids: string[], tagName: string) {
    const [t] = await this.ensureTags([tagName]);
    const set = new Set(ids);
    const changed = this.lib.bookmarks
      .filter((b) => set.has(b.id) && !b.tagIds.includes(t.id))
      .map((b) => ({ ...b, tagIds: [...b.tagIds, t.id], updatedAt: now() }));
    await this.storage.saveBookmarks(changed);
    this.replaceBookmarks(changed);
    this.emit();
  }

  /** Deletes and returns the removed bookmarks so the UI can offer Undo. */
  async deleteBookmarks(ids: string[]): Promise<Bookmark[]> {
    const set = new Set(ids);
    const removed = this.lib.bookmarks.filter((b) => set.has(b.id));
    await this.storage.deleteBookmarks(ids);
    this.lib.bookmarks = this.lib.bookmarks.filter((b) => !set.has(b.id));
    this.emit();
    return removed;
  }

  async restoreBookmarks(bookmarks: Bookmark[]) {
    const fresh = bookmarks.filter((b) => !this.findByKey(b.dedupeKey));
    await this.storage.saveBookmarks(fresh);
    this.lib.bookmarks = [...this.lib.bookmarks, ...fresh];
    this.emit();
  }

  // ----- metadata -----

  private async applyMetadata(b: Bookmark, meta: FetchedMetadata | undefined): Promise<Bookmark> {
    if (!meta) return { ...b, metadataStatus: 'failed', updatedAt: now() };
    const categoryId = b.categoryId ?? (meta.categoryName ? (await this.ensureCategory(meta.categoryName)).id : null);
    const fetchedTags = meta.tags.length ? (await this.ensureTags(meta.tags)).map((t) => t.id) : [];
    return {
      ...b,
      // Keep the user's own edits to title/description if they made any.
      title: b.metadataStatus === 'ok' && b.title ? b.title : meta.title || b.title,
      description: b.metadataStatus === 'ok' && b.description ? b.description : meta.description,
      thumbnailUrl: meta.thumbnailUrl || b.thumbnailUrl,
      channelName: meta.channelName || b.channelName,
      categoryId,
      tagIds: [...new Set([...b.tagIds, ...fetchedTags])],
      durationSec: meta.durationSec,
      publishedAt: meta.publishedAt,
      viewCount: meta.viewCount,
      itemCount: meta.itemCount,
      metadataStatus: 'ok',
      updatedAt: now(),
    };
  }

  /**
   * Fetches title, description, thumbnail, category and tags from the YouTube
   * Data API. Without a key the bookmark keeps its instant thumbnail and is
   * marked "partial" so it can be refreshed once a key is added.
   */
  async refreshMetadata(ids: string[], onProgress?: (done: number, total: number) => void) {
    const set = new Set(ids);
    const targets = this.lib.bookmarks.filter((b) => set.has(b.id));
    if (!targets.length) return;
    if (!this.apiKey) {
      const changed = targets.filter((b) => b.metadataStatus === 'pending').map((b) => ({ ...b, metadataStatus: 'partial' as const }));
      await this.storage.saveBookmarks(changed);
      this.replaceBookmarks(changed);
      this.emit();
      return;
    }
    const api = this.makeApi(this.apiKey);
    const CHUNK = 50;
    for (let i = 0; i < targets.length; i += CHUNK) {
      const part = targets.slice(i, i + CHUNK);
      part.forEach((b) => this.fetching.add(b.id));
      this.emit();
      let metas: Map<string, FetchedMetadata> | null = null;
      let error: unknown = null;
      try {
        metas = await api.fetchMany(part.map((b) => ({ type: b.type, youtubeId: b.youtubeId })));
      } catch (e) {
        error = e;
      }
      const changed: Bookmark[] = [];
      for (const b of part) {
        const current = this.lib.bookmarks.find((x) => x.id === b.id);
        if (!current) continue; // deleted while fetching
        changed.push(metas ? await this.applyMetadata(current, metas.get(`${b.type}:${b.youtubeId}`)) : { ...current, metadataStatus: 'failed' });
      }
      await this.storage.saveBookmarks(changed);
      this.replaceBookmarks(changed);
      part.forEach((b) => this.fetching.delete(b.id));
      this.emit();
      onProgress?.(Math.min(i + CHUNK, targets.length), targets.length);
      if (error) throw error;
    }
  }

  /** Bookmarks that still need metadata (new imports, failures, added without a key). */
  get needsMetadata(): Bookmark[] {
    return this.lib.bookmarks.filter((b) => b.metadataStatus !== 'ok');
  }

  // ----- import -----

  /** Counts what an import would do, without writing anything. */
  previewImport(items: ImportItem[], mode: 'merge' | 'replace'): ImportResult {
    if (mode === 'replace') return { added: items.length, duplicates: 0 };
    const duplicates = items.filter((it) => this.findByKey(it.dedupeKey)).length;
    return { added: items.length - duplicates, duplicates };
  }

  async importItems(items: ImportItem[], mode: 'merge' | 'replace'): Promise<ImportResult> {
    if (mode === 'replace') {
      await this.storage.clear();
      this.lib = { bookmarks: [], categories: [], tags: [] };
    }
    const fresh: Bookmark[] = [];
    let duplicates = 0;
    for (const it of items) {
      const existing = this.findByKey(it.dedupeKey);
      if (existing) {
        // Existing bookmarks keep your edits and only gain new tags.
        duplicates++;
        if (it.tagNames?.length) {
          const tagIds = (await this.ensureTags(it.tagNames)).map((t) => t.id);
          const merged = { ...existing, tagIds: [...new Set([...existing.tagIds, ...tagIds])] };
          if (merged.tagIds.length !== existing.tagIds.length) {
            await this.storage.saveBookmarks([merged]);
            this.replaceBookmarks([merged]);
          }
        }
        continue;
      }
      const t = it.createdAt ?? now();
      fresh.push({
        id: uid(),
        url: it.url,
        type: it.type,
        youtubeId: it.youtubeId,
        dedupeKey: it.dedupeKey,
        title: it.title ?? '',
        description: it.description ?? '',
        thumbnailUrl: it.thumbnailUrl || instantThumbnail(it.type, it.youtubeId),
        channelName: it.channelName ?? '',
        categoryId: it.categoryName ? (await this.ensureCategory(it.categoryName)).id : null,
        tagIds: it.tagNames?.length ? (await this.ensureTags(it.tagNames)).map((x) => x.id) : [],
        durationSec: it.durationSec ?? null,
        publishedAt: it.publishedAt ?? null,
        viewCount: it.viewCount ?? null,
        itemCount: it.itemCount ?? null,
        notes: it.notes ?? '',
        watched: !!it.watched,
        createdAt: t,
        updatedAt: t,
        metadataStatus: it.title ? 'ok' : 'pending',
      });
    }
    await this.storage.saveBookmarks(fresh);
    this.lib.bookmarks = [...this.lib.bookmarks, ...fresh];
    this.emit();
    return { added: fresh.length, duplicates };
  }
}
