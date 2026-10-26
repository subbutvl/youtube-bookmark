import { LINK_FLAGS, QUICK_LAUNCH_MAX, sectionFor, type Link, type LinkFlag, type LinkLibrary, type LinkSection } from './link-types';
import { fallbackFavicon, parseLink } from './link-url';
import type { PageMeta } from './page-meta';
import type { LinkStorage } from './storage';
import { CATEGORY_COLORS, type Category, type Tag } from './types';
import { splitUrls } from './youtube-url';

/** Fetches a page and reads its details; injected so tests and the browser preview can stub it. */
export type MetaFetcher = (url: string) => Promise<PageMeta & { finalUrl: string }>;

export interface LinkAddResult {
  added: Link[];
  duplicates: { input: string; existing: Link }[];
  invalid: string[];
}

/** One link to import, from a backup, a CSV, a browser's bookmarks or plain text. */
export interface LinkImportItem {
  url: string;
  dedupeKey: string;
  domain: string;
  title?: string;
  description?: string;
  faviconUrl?: string;
  imageUrl?: string;
  siteName?: string;
  categoryName?: string;
  tagNames?: string[];
  notes?: string;
  viewed?: boolean;
  flags?: LinkFlag[];
  openCount?: number;
  lastOpenedAt?: string | null;
  quickLaunch?: number | null;
  createdAt?: string;
  groupName?: string | null;
  /** Tags an earlier import made from this link's folders; removed when the folders are re-applied as categories. */
  folderTags?: string[];
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
/** Pages fetched at once when filling in details; keeps big imports polite to sites. */
const FETCH_CONCURRENCY = 4;

/** The in-memory link library and every operation on it, written through to storage. */
export class LinkStore {
  private lib: LinkLibrary = { links: [], categories: [], tags: [] };
  private listeners = new Set<() => void>();
  private fetching = new Set<string>();
  /** Links whose details are being fetched in bulk, for the progress banner. */
  progress: { done: number; total: number } | null = null;

  constructor(private readonly storage: LinkStorage, private readonly fetchMeta: MetaFetcher) {}

  async init() {
    this.lib = await this.storage.load();
    this.emit();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.lib;
  private emit() {
    this.lib = { ...this.lib };
    for (const fn of this.listeners) fn();
  }

  isFetching(id: string) {
    return this.fetching.has(id);
  }

  findByKey(dedupeKey: string): Link | undefined {
    return this.lib.links.find((l) => l.dedupeKey === dedupeKey);
  }

  private replace(changed: Link[]) {
    const byId = new Map(changed.map((l) => [l.id, l]));
    this.lib.links = this.lib.links.map((l) => byId.get(l.id) ?? l);
  }

  private async save(changed: Link[]) {
    if (!changed.length) return;
    await this.storage.saveLinks(changed);
    this.replace(changed);
    this.emit();
  }

  private change(ids: string[], fn: (l: Link) => Link | null) {
    const set = new Set(ids);
    return this.lib.links.flatMap((l) => {
      if (!set.has(l.id)) return [];
      const next = fn(l);
      return next ? [{ ...next, updatedAt: now() }] : [];
    });
  }

  // ----- categories and tags (same rules as the YouTube library) -----

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

  async mergeCategory(fromId: string, toId: string) {
    const moved = this.lib.links.filter((l) => l.categoryId === fromId).map((l) => ({ ...l, categoryId: toId, updatedAt: now() }));
    await this.storage.saveLinks(moved);
    this.replace(moved);
    await this.deleteCategory(fromId);
  }

  async deleteCategory(id: string) {
    await this.storage.deleteCategory(id);
    this.lib.categories = this.lib.categories.filter((c) => c.id !== id);
    this.lib.links = this.lib.links.map((l) => (l.categoryId === id ? { ...l, categoryId: null } : l));
    this.emit();
  }

  async addTag(name: string) {
    const [t] = await this.ensureTags([name]);
    this.emit();
    return t;
  }

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
    const changed = this.lib.links
      .filter((l) => l.tagIds.some((t) => from.has(t)))
      .map((l) => ({ ...l, tagIds: [...new Set(l.tagIds.map((t) => (from.has(t) ? toId : t)))], updatedAt: now() }));
    await this.storage.saveLinks(changed);
    this.replace(changed);
    await this.deleteTags([...from]);
  }

  async deleteTags(ids: string[]) {
    const drop = new Set(ids);
    await this.storage.deleteTags(ids);
    this.lib.tags = this.lib.tags.filter((t) => !drop.has(t.id));
    this.lib.links = this.lib.links.map((l) => (l.tagIds.some((t) => drop.has(t)) ? { ...l, tagIds: l.tagIds.filter((t) => !drop.has(t)) } : l));
    this.emit();
  }

  // ----- links -----

  /** Adds every web link in `text` (or the given list). Duplicates are reported, never stored. Details are fetched in the background. */
  async addUrls(input: string | string[], opts: { categoryId?: string | null; tagNames?: string[] } = {}): Promise<LinkAddResult> {
    const result: LinkAddResult = { added: [], duplicates: [], invalid: [] };
    const tags = opts.tagNames?.length ? await this.ensureTags(opts.tagNames) : [];
    const batch = new Map<string, Link>();
    for (const raw of typeof input === 'string' ? splitUrls(input) : input) {
      const p = parseLink(raw);
      if (!p) {
        result.invalid.push(raw);
        continue;
      }
      const existing = this.findByKey(p.dedupeKey) ?? batch.get(p.dedupeKey);
      if (existing) {
        result.duplicates.push({ input: raw, existing });
        continue;
      }
      const t = now();
      batch.set(p.dedupeKey, {
        id: uid(),
        url: p.url,
        dedupeKey: p.dedupeKey,
        domain: p.domain,
        title: '',
        description: '',
        faviconUrl: fallbackFavicon(p.domain),
        imageUrl: '',
        siteName: '',
        categoryId: opts.categoryId ?? null,
        tagIds: tags.map((x) => x.id),
        notes: '',
        viewed: false,
        flags: [],
        openCount: 0,
        lastOpenedAt: null,
        quickLaunch: null,
        createdAt: t,
        updatedAt: t,
        metadataStatus: 'pending',
        section: sectionFor(p.domain),
        groupName: null,
      });
    }
    result.added = [...batch.values()];
    if (result.added.length) {
      await this.storage.saveLinks(result.added);
      this.lib.links = [...this.lib.links, ...result.added];
    }
    this.emit();
    if (result.added.length) void this.refreshMetadata(result.added.map((l) => l.id));
    return result;
  }

  async updateLink(id: string, patch: Partial<Omit<Link, 'id' | 'createdAt'>>, tagNames?: string[]) {
    const l = this.lib.links.find((x) => x.id === id);
    if (!l) return;
    if (patch.url && patch.url !== l.url) {
      const p = parseLink(patch.url);
      if (!p) throw new Error('That isn’t a valid web link.');
      const other = this.findByKey(p.dedupeKey);
      if (other && other.id !== id) throw new Error('Another saved link already points to that page.');
      patch = { ...patch, url: p.url, dedupeKey: p.dedupeKey, domain: p.domain, section: patch.section ?? (p.domain === l.domain ? l.section : sectionFor(p.domain)) };
    }
    const tagIds = tagNames ? (await this.ensureTags(tagNames)).map((t) => t.id) : patch.tagIds ?? l.tagIds;
    await this.save([{ ...l, ...patch, tagIds, updatedAt: now() }]);
  }

  async setViewed(ids: string[], viewed: boolean) {
    await this.save(this.change(ids, (l) => (l.viewed === viewed ? null : { ...l, viewed })));
  }

  /** Turns a flag on or off for every given link. */
  async setFlag(ids: string[], flag: LinkFlag, on: boolean) {
    await this.save(this.change(ids, (l) => {
      if (l.flags.includes(flag) === on) return null;
      const flags = on ? LINK_FLAGS.filter((f) => f === flag || l.flags.includes(f)) : l.flags.filter((f) => f !== flag);
      return { ...l, flags };
    }));
  }

  /** Counts an open: the link stops being New and becomes Viewed. */
  async markOpened(id: string) {
    await this.save(this.change([id], (l) => ({ ...l, viewed: true, openCount: l.openCount + 1, lastOpenedAt: now() })));
  }

  async setCategory(ids: string[], categoryId: string | null) {
    await this.save(this.change(ids, (l) => ({ ...l, categoryId })));
  }

  async setCategoryByName(ids: string[], name: string) {
    const c = await this.ensureCategory(name);
    await this.setCategory(ids, c.id);
    return c;
  }

  async setTags(id: string, names: string[]) {
    await this.updateLink(id, {}, names);
  }

  async addTagToMany(ids: string[], tagName: string) {
    const [t] = await this.ensureTags([tagName]);
    await this.save(this.change(ids, (l) => (l.tagIds.includes(t.id) ? null : { ...l, tagIds: [...l.tagIds, t.id] })));
  }

  async deleteLinks(ids: string[]): Promise<Link[]> {
    const set = new Set(ids);
    const removed = this.lib.links.filter((l) => set.has(l.id));
    await this.storage.deleteLinks(ids);
    this.lib.links = this.lib.links.filter((l) => !set.has(l.id));
    this.emit();
    return removed;
  }

  async restoreLinks(links: Link[]) {
    const fresh = links.filter((l) => !this.findByKey(l.dedupeKey));
    await this.storage.saveLinks(fresh);
    this.lib.links = [...this.lib.links, ...fresh];
    this.emit();
  }

  // ----- manual groups and tabs -----

  /** Puts links in a group of the user's own (null takes them out). */
  async setGroup(ids: string[], name: string | null) {
    const groupName = name?.trim() || null;
    await this.save(this.change(ids, (l) => (l.groupName === groupName ? null : { ...l, groupName })));
  }

  async renameGroup(section: LinkSection, from: string, to: string) {
    const ids = this.lib.links.filter((l) => l.section === section && l.groupName === from).map((l) => l.id);
    await this.setGroup(ids, to);
  }

  /** Group names in use in a tab, A to Z. */
  groupNames(section: LinkSection): string[] {
    return [...new Set(this.lib.links.flatMap((l) => (l.section === section && l.groupName ? [l.groupName] : [])))].sort((a, b) => a.localeCompare(b));
  }

  async moveToSection(ids: string[], section: LinkSection) {
    await this.save(this.change(ids, (l) => (l.section === section ? null : { ...l, section, quickLaunch: null })));
  }

  // ----- quick launch (each tab has its own) -----

  quickLaunchFor(section: LinkSection): Link[] {
    return this.lib.links.filter((l) => l.section === section && l.quickLaunch != null).sort((a, b) => a.quickLaunch! - b.quickLaunch!);
  }

  async pin(id: string) {
    const l = this.lib.links.find((x) => x.id === id);
    if (!l || l.quickLaunch != null) return;
    const pinned = this.quickLaunchFor(l.section);
    if (pinned.length >= QUICK_LAUNCH_MAX) throw new Error(`Quick launch holds up to ${QUICK_LAUNCH_MAX} links. Unpin one first.`);
    await this.save(this.change([id], (x) => ({ ...x, quickLaunch: pinned.length ? pinned[pinned.length - 1].quickLaunch! + 1 : 0 })));
  }

  async unpin(id: string) {
    await this.save(this.change([id], (l) => (l.quickLaunch == null ? null : { ...l, quickLaunch: null })));
  }

  /** Saves the quick launch order of one tab's pinned links. */
  async reorderQuickLaunch(orderedIds: string[]) {
    const pos = new Map(orderedIds.map((id, i) => [id, i]));
    await this.save(this.change(orderedIds, (l) => (pos.get(l.id) === l.quickLaunch ? null : { ...l, quickLaunch: pos.get(l.id)! })));
  }

  // ----- details from the page -----

  get needsMetadata(): Link[] {
    return this.lib.links.filter((l) => l.metadataStatus === 'pending' || l.metadataStatus === 'partial');
  }

  private async applyMeta(l: Link, force: boolean): Promise<Link> {
    try {
      const m = await this.fetchMeta(l.url);
      // A page's keywords become tags only for links not yet sorted (no category, no tags).
      const fetchedTags = m.keywords.length && !l.tagIds.length && !l.categoryId ? (await this.ensureTags(m.keywords)).map((t) => t.id) : [];
      const current = this.lib.links.find((x) => x.id === l.id) ?? l;
      return {
        ...current,
        // Keep anything the user (or an import) already filled in, unless asked to refresh.
        title: (force ? m.title || current.title : current.title || m.title).slice(0, 300),
        description: force ? m.description || current.description : current.description || m.description,
        imageUrl: force ? m.imageUrl || current.imageUrl : current.imageUrl || m.imageUrl,
        faviconUrl: m.faviconUrl || current.faviconUrl,
        siteName: force ? m.siteName || current.siteName : current.siteName || m.siteName,
        tagIds: [...new Set([...current.tagIds, ...fetchedTags])],
        metadataStatus: m.title ? 'ok' : 'partial',
        updatedAt: now(),
      };
    } catch {
      const current = this.lib.links.find((x) => x.id === l.id) ?? l;
      return { ...current, metadataStatus: 'failed', updatedAt: now() };
    }
  }

  /** Reads title, description, image and icon from each page, a few at a time. */
  async refreshMetadata(ids: string[], onProgress?: (done: number, total: number) => void, force = false) {
    const set = new Set(ids);
    const queue = this.lib.links.filter((l) => set.has(l.id));
    const total = queue.length;
    let done = 0;
    const bulk = total > 1 && !this.progress;
    if (bulk) this.progress = { done: 0, total };
    const worker = async () => {
      for (let l = queue.shift(); l; l = queue.shift()) {
        if (!this.lib.links.some((x) => x.id === l!.id)) continue; // deleted meanwhile
        this.fetching.add(l.id);
        this.emit();
        const next = await this.applyMeta(l, force);
        this.fetching.delete(l.id);
        if (this.lib.links.some((x) => x.id === l!.id)) await this.save([next]);
        // Count outside the call: `onProgress?.(++done)` skips the increment when there's no callback.
        done++;
        onProgress?.(done, total);
        if (bulk) this.progress = { done, total };
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, total) }, worker));
    } finally {
      if (bulk) {
        this.progress = null;
        this.emit();
      }
    }
  }

  // ----- import -----

  previewImport(items: LinkImportItem[], mode: 'merge' | 'replace') {
    if (mode === 'replace') return { added: items.length, duplicates: 0 };
    const duplicates = items.filter((it) => this.findByKey(it.dedupeKey)).length;
    return { added: items.length - duplicates, duplicates };
  }

  /**
   * Adds the items that aren't saved yet. With `reapplyFolders`, links already saved also take
   * the file's folder as their category, and the tags an earlier import made from folders go.
   * With `skipNew`, nothing is added (only folders are re-applied).
   */
  async importItems(items: LinkImportItem[], mode: 'merge' | 'replace', opts: { reapplyFolders?: boolean; skipNew?: boolean } = {}) {
    if (mode === 'replace') {
      await this.storage.clear();
      this.lib = { links: [], categories: [], tags: [] };
    }
    const fresh: Link[] = [];
    const updated: Link[] = [];
    let duplicates = 0;
    const pinFor = (section: LinkSection) => {
      const pinned = [...this.quickLaunchFor(section), ...fresh.filter((l) => l.section === section && l.quickLaunch != null)];
      return pinned.length >= QUICK_LAUNCH_MAX ? null : pinned.reduce((n, l) => Math.max(n, l.quickLaunch! + 1), 0);
    };
    const folderTagNames = new Set<string>();
    const topFolders = new Set<string>();
    for (const it of items) {
      const existing = this.findByKey(it.dedupeKey) ?? fresh.find((l) => l.dedupeKey === it.dedupeKey);
      if (existing) {
        duplicates++;
        if (opts.reapplyFolders && !fresh.includes(existing) && !updated.some((l) => l.id === existing.id)) {
          const drop = new Set((it.folderTags ?? []).map((n) => n.toLowerCase()));
          it.folderTags?.forEach((n) => folderTagNames.add(n.toLowerCase()));
          if (it.categoryName) topFolders.add(it.categoryName.split(' / ')[0].toLowerCase());
          const categoryId = it.categoryName ? (await this.ensureCategory(it.categoryName)).id : existing.categoryId;
          const tagIds = existing.tagIds.filter((id) => !drop.has(this.lib.tags.find((t) => t.id === id)?.name.toLowerCase() ?? ''));
          if (categoryId !== existing.categoryId || tagIds.length !== existing.tagIds.length) updated.push({ ...existing, categoryId, tagIds, updatedAt: now() });
        }
        continue;
      }
      // "Update folders only": links deleted since an earlier import stay deleted.
      if (opts.skipNew && mode === 'merge') continue;
      const t = it.createdAt ?? now();
      const section = sectionFor(it.domain);
      fresh.push({
        id: uid(),
        url: it.url,
        dedupeKey: it.dedupeKey,
        domain: it.domain,
        title: it.title ?? '',
        description: it.description ?? '',
        faviconUrl: it.faviconUrl || fallbackFavicon(it.domain),
        imageUrl: it.imageUrl ?? '',
        siteName: it.siteName ?? '',
        categoryId: it.categoryName ? (await this.ensureCategory(it.categoryName)).id : null,
        tagIds: it.tagNames?.length ? (await this.ensureTags(it.tagNames)).map((x) => x.id) : [],
        notes: it.notes ?? '',
        viewed: !!it.viewed,
        flags: (it.flags ?? []).filter((f) => LINK_FLAGS.includes(f)),
        openCount: it.openCount ?? 0,
        lastOpenedAt: it.lastOpenedAt ?? null,
        quickLaunch: it.quickLaunch != null ? pinFor(section) : null,
        createdAt: t,
        updatedAt: t,
        // Imported titles are kept, but every link still gets its page details (description, image, icon).
        metadataStatus: 'pending',
        section,
        groupName: it.groupName?.trim() || null,
      });
    }
    await this.storage.saveLinks([...fresh, ...updated]);
    this.lib.links = [...this.replaceAll(updated), ...fresh];
    if (updated.length) await this.dropUnused(folderTagNames, topFolders);
    this.emit();
    return { added: fresh.length, duplicates, updated: updated.length };
  }

  private replaceAll(changed: Link[]): Link[] {
    const byId = new Map(changed.map((l) => [l.id, l]));
    return this.lib.links.map((l) => byId.get(l.id) ?? l);
  }

  /** Removes the folder tags and old top-level categories that no link uses any more. */
  private async dropUnused(tagNames: Set<string>, categoryNames: Set<string>) {
    const usedTags = new Set(this.lib.links.flatMap((l) => l.tagIds));
    const tags = this.lib.tags.filter((t) => tagNames.has(t.name.toLowerCase()) && !usedTags.has(t.id)).map((t) => t.id);
    if (tags.length) {
      await this.storage.deleteTags(tags);
      const drop = new Set(tags);
      this.lib.tags = this.lib.tags.filter((t) => !drop.has(t.id));
    }
    const usedCats = new Set(this.lib.links.map((l) => l.categoryId));
    for (const c of this.lib.categories.filter((c) => categoryNames.has(c.name.toLowerCase()) && !usedCats.has(c.id))) {
      await this.storage.deleteCategory(c.id);
      this.lib.categories = this.lib.categories.filter((x) => x.id !== c.id);
    }
  }
}
