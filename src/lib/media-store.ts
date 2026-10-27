import { addLink, linkLabel, findTrailer, findWikiArticle, justWatchByPath, languageFromScript, parseMediaInput, searchImdb, searchJustWatch, searchTitles, wikidataByImdb, wikiSummary, type Candidate, type MediaFetchers } from './media-sources';
import { blankItem, normTitle, sameTitle, type MediaItem, type MediaKind, type MediaLibrary, type WatchOption } from './media-types';
import { TOP_MOVIES, TOP_TV } from './media-top';
import type { MediaStorage } from './storage';

const now = () => new Date().toISOString();
/** Titles looked up at once. */
const CONCURRENCY = 4;

/** A title from a search result, ready to save. */
export function itemFromCandidate(c: Candidate, patch: Partial<MediaItem> = {}): MediaItem {
  return blankItem(c.kind, {
    title: c.title,
    originalTitle: c.originalTitle,
    year: c.year,
    language: languageFromScript(c.originalTitle),
    synopsis: c.synopsis,
    posterUrl: c.posterUrl,
    imdbId: c.imdbId,
    imdbRating: c.imdbRating,
    imdbVotes: c.imdbVotes,
    rtScore: c.rtScore,
    genres: c.genres,
    runtime: c.runtime,
    seasons: c.seasons,
    trailerId: c.trailerId,
    justwatchPath: c.justwatchPath,
    watch: c.watch,
    metadataStatus: 'pending',
    ...patch,
  });
}

/** The search result that is this title: same IMDb id, else same name (or original name) within a year. */
export function bestMatch(cands: Candidate[], item: Pick<MediaItem, 'kind' | 'title' | 'originalTitle' | 'year' | 'imdbId'>): Candidate | null {
  if (item.imdbId) {
    const byId = cands.find((c) => c.imdbId === item.imdbId);
    if (byId) return byId;
  }
  const names = new Set([normTitle(item.title), normTitle(item.originalTitle)].filter(Boolean));
  const yearOk = (c: Candidate) => item.year == null || c.year == null || Math.abs(c.year - item.year) <= 1;
  const named = cands.filter((c) => c.kind === item.kind && (names.has(normTitle(c.title)) || names.has(normTitle(c.originalTitle))));
  return named.find((c) => item.year != null && c.year === item.year) ?? named.find(yearOk) ?? null;
}

/** Fetched where-to-watch replaces the old fetched list; platforms typed in by hand stay. */
export function mergeWatch(old: WatchOption[], fetched: WatchOption[]): WatchOption[] {
  const manual = old.filter((w) => w.manual);
  const has = (w: WatchOption) => manual.some((m) => m.provider.toLowerCase() === w.provider.toLowerCase() && m.type === w.type);
  return [...manual, ...fetched.filter((w) => !has(w))];
}

export interface MediaProgress {
  done: number;
  total: number;
}

/** The Movies and TV Shows tabs' library, kept in memory and written through to storage. */
export class MediaStore {
  private lib: MediaLibrary = { items: [] };
  private listeners = new Set<() => void>();
  /** Titles being looked up right now. */
  fetching = new Set<string>();
  progress: MediaProgress | null = null;

  constructor(
    private readonly storage: MediaStorage,
    private readonly fetchers: MediaFetchers | null,
    /** The country whose streaming platforms are shown (JustWatch), e.g. IN. */
    private readonly country: () => string,
  ) {}

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

  get canFetch() {
    return !!this.fetchers;
  }

  private need(): MediaFetchers {
    if (!this.fetchers) throw new Error('Movie and TV details are looked up in the desktop app only.');
    return this.fetchers;
  }

  find(probe: Pick<MediaItem, 'kind' | 'imdbId' | 'title' | 'year'>): MediaItem | undefined {
    return this.lib.items.find((i) => sameTitle(i, probe));
  }

  private async put(items: MediaItem[]) {
    if (!items.length) return;
    await this.storage.save(items);
    const byId = new Map(this.lib.items.map((i) => [i.id, i]));
    for (const i of items) byId.set(i.id, i);
    this.lib.items = [...byId.values()];
    this.emit();
  }

  /** Searches for what was typed or pasted: a name, or an IMDb, JustWatch, Wikipedia or review site link. */
  async search(text: string, kind: MediaKind | null): Promise<Candidate[]> {
    const f = this.need();
    const input = parseMediaInput(text);
    const c = this.country();
    if (input.kind === 'justwatch') {
      const hit = await justWatchByPath(f, input.path, c);
      return hit ? [hit] : [];
    }
    if (input.kind === 'imdb') {
      const wd = await wikidataByImdb(f, input.imdbId).catch(() => null);
      const hits = wd?.title ? await searchTitles(f, wd.title, wd.kind, c).catch(() => []) : [];
      const exact = hits.find((h) => h.imdbId === input.imdbId);
      if (exact) return [exact];
      // Not on JustWatch: keep the IMDb id with whatever Wikidata knows.
      if (wd) return [{ ...(await searchImdb(f, wd.title, wd.kind).catch(() => [])).find((h) => h.imdbId === input.imdbId) ?? blankCandidate(wd.kind), title: wd.title, year: wd.year, imdbId: input.imdbId, source: 'wikipedia' }];
      return [];
    }
    if (input.kind === 'wiki') {
      const name = input.title.replace(/\s*\([^)]*\)\s*$/, '');
      const hint = input.title.match(/\((\d{4})?\s*(?:\w+\s)?(film|TV series|television series|miniseries|web series|series)\)$/i);
      const k: MediaKind | null = hint ? (/film/i.test(hint[2]) ? 'movie' : 'tv') : kind;
      const hits = await searchTitles(f, name, k, c);
      const year = hint?.[1] ? Number(hint[1]) : null;
      return year ? [...hits.filter((h) => h.year === year), ...hits.filter((h) => h.year !== year)] : hits;
    }
    if (input.kind === 'search') {
      const hits = await searchTitles(f, input.query, kind, c);
      return input.year ? [...hits.filter((h) => h.year === input.year), ...hits.filter((h) => h.year !== input.year)] : hits;
    }
    return [];
  }

  /** Movie and TV links pasted or imported elsewhere: each is looked up and saved here, with the link kept on the title. */
  async addLinks(urls: string[]): Promise<{ added: number; existed: number }> {
    let added = 0;
    let existed = 0;
    for (const url of urls) {
      const input = parseMediaInput(url);
      const keep = input.kind === 'imdb' || input.kind === 'justwatch' ? [] : [{ label: linkLabel(url), url }];
      let hit: Candidate | undefined;
      try {
        hit = (await this.search(url, null))[0];
      } catch {
        hit = undefined;
      }
      if (hit) {
        const found = this.find(hit);
        if (found) {
          existed++;
          if (keep.length) await this.update(found.id, { links: addLink(found.links, keep[0]) });
          continue;
        }
        await this.addCandidate(hit, { links: keep });
        added++;
        continue;
      }
      // Couldn't tell which title it is: keep it with a name from the link, to fix by hand.
      const title = input.kind === 'search' ? input.query : input.kind === 'wiki' ? input.title.replace(/\s*\([^)]*\)\s*$/, '') : input.kind === 'imdb' ? input.imdbId : url;
      const kind: MediaKind = /\/tv\/|tv-show|series/i.test(url) ? 'tv' : 'movie';
      const imdbId = input.kind === 'imdb' ? input.imdbId : '';
      if (this.find({ kind, title, year: null, imdbId })) {
        existed++;
        continue;
      }
      await this.put([blankItem(kind, { title, imdbId, links: keep, metadataStatus: 'failed' })]);
      added++;
    }
    return { added, existed };
  }

  /** Saves a search result; the rest (Wikipedia, language) is looked up right after. */
  async addCandidate(c: Candidate, patch: Partial<MediaItem> = {}): Promise<{ item: MediaItem; existed: boolean }> {
    const existing = this.find(c);
    if (existing) return { item: existing, existed: true };
    const item = itemFromCandidate(c, patch);
    await this.put([item]);
    void this.fetchDetails([item.id]);
    return { item, existed: false };
  }

  /** Saves a title typed in by hand. */
  async addManual(item: MediaItem): Promise<{ item: MediaItem; existed: boolean }> {
    const existing = this.find(item);
    if (existing) return { item: existing, existed: true };
    await this.put([{ ...item, metadataStatus: 'manual', createdAt: now(), updatedAt: now() }]);
    return { item, existed: false };
  }

  async update(id: string, patch: Partial<MediaItem>) {
    const old = this.lib.items.find((i) => i.id === id);
    if (!old) return;
    await this.put([{ ...old, ...patch, id, updatedAt: now() }]);
  }

  /** Points a title at another search result (when the first match was wrong), keeping your status, notes and platforms. */
  async relink(id: string, c: Candidate) {
    const old = this.lib.items.find((i) => i.id === id);
    if (!old) return;
    const fresh = itemFromCandidate(c);
    await this.put([{
      ...fresh,
      id,
      kind: c.kind,
      status: old.status,
      myRating: old.myRating,
      notes: old.notes,
      links: old.links.filter((l) => !/wikipedia\.org|justwatch\.com/.test(l.url)),
      watch: mergeWatch(old.watch, fresh.watch),
      createdAt: old.createdAt,
      updatedAt: now(),
    }]);
    void this.fetchDetails([id]);
  }

  async remove(ids: string[]) {
    if (!ids.length) return;
    await this.storage.delete(ids);
    const drop = new Set(ids);
    this.lib.items = this.lib.items.filter((i) => !drop.has(i.id));
    this.emit();
  }

  /** Adds the top 100 list for movies or TV shows (titles already saved are skipped) and looks them up. */
  async addTop(kind: MediaKind): Promise<{ added: number; skipped: number }> {
    const list = kind === 'movie' ? TOP_MOVIES : TOP_TV;
    const base = Date.now();
    const fresh: MediaItem[] = [];
    for (const [title, year] of list) {
      if (this.find({ kind, title, year, imdbId: '' }) || fresh.some((i) => sameTitle(i, { kind, title, year, imdbId: '' }))) continue;
      // Earlier ranks get later times, so "Recently added" lists them in rank order.
      const at = new Date(base - fresh.length * 1000).toISOString();
      fresh.push(blankItem(kind, { title, year, metadataStatus: 'pending', createdAt: at, updatedAt: at }));
    }
    await this.put(fresh);
    void this.fetchDetails(fresh.map((i) => i.id));
    return { added: fresh.length, skipped: list.length - fresh.length };
  }

  /** Looks the titles up again: JustWatch (ratings, poster, synopsis, platforms) and Wikipedia. */
  async fetchDetails(ids: string[]) {
    if (!this.fetchers) return;
    const todo = ids.filter((id) => !this.fetching.has(id));
    if (!todo.length) return;
    for (const id of todo) this.fetching.add(id);
    this.progress = { done: 0, total: (this.progress?.total ?? 0) - (this.progress?.done ?? 0) + todo.length };
    this.emit();
    const queue = [...todo];
    const work = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          const item = this.lib.items.find((i) => i.id === id);
          if (item) await this.put([await this.lookup(item)]);
        } catch {
          const item = this.lib.items.find((i) => i.id === id);
          if (item) await this.put([{ ...item, metadataStatus: 'failed', fetchedAt: now() }]).catch(() => {});
        } finally {
          this.fetching.delete(id);
          if (this.progress) this.progress = { ...this.progress, done: this.progress.done + 1 };
          if (this.progress && this.progress.done >= this.progress.total) this.progress = null;
          this.emit();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, work));
  }

  /** One title's details from every source; values you typed are kept, ratings and platforms are refreshed. */
  private async lookup(item: MediaItem): Promise<MediaItem> {
    const f = this.need();
    const c = this.country();
    let hit: Candidate | null = null;
    try {
      hit = item.justwatchPath ? await justWatchByPath(f, item.justwatchPath, c) : null;
      if (!hit) hit = bestMatch(await searchJustWatch(f, item.title, item.kind, c, 10), item);
      if (!hit && item.originalTitle) hit = bestMatch(await searchJustWatch(f, item.originalTitle, item.kind, c, 10), item);
    } catch {
      // JustWatch is unreachable or changed; IMDb and Wikipedia still help.
    }
    if (!hit && !item.imdbId) hit = bestMatch(await searchImdb(f, item.title, item.kind).catch(() => []), item);

    const next: MediaItem = { ...item };
    const fill = <K extends keyof MediaItem>(k: K, v: MediaItem[K] | null | undefined) => {
      const cur = next[k];
      const empty = cur == null || cur === '' || (Array.isArray(cur) && !cur.length);
      if (empty && v != null && v !== '' && !(Array.isArray(v) && !v.length)) next[k] = v;
    };
    if (hit) {
      fill('originalTitle', hit.originalTitle);
      fill('year', hit.year);
      fill('synopsis', hit.synopsis);
      fill('posterUrl', hit.posterUrl);
      fill('imdbId', hit.imdbId);
      fill('genres', hit.genres);
      fill('runtime', hit.runtime);
      fill('trailerId', hit.trailerId);
      if (hit.imdbRating != null) next.imdbRating = hit.imdbRating;
      if (hit.imdbVotes != null) next.imdbVotes = hit.imdbVotes;
      if (hit.rtScore != null) next.rtScore = hit.rtScore;
      if (hit.seasons != null) next.seasons = hit.seasons;
      if (hit.justwatchPath) {
        next.justwatchPath = hit.justwatchPath;
        next.watch = mergeWatch(item.watch, hit.watch);
      }
      fill('language', languageFromScript(hit.originalTitle));
    }

    // Wikipedia: the article link, a summary when JustWatch had none, and the language.
    try {
      let article = '';
      if (next.imdbId) article = (await wikidataByImdb(f, next.imdbId).catch(() => null))?.wikiTitle ?? '';
      if (!article) article = await findWikiArticle(f, next.title, next.year, next.kind);
      const wiki = article ? await wikiSummary(f, article) : null;
      if (wiki) {
        next.links = addLink(next.links, { label: 'Wikipedia', url: wiki.url });
        fill('synopsis', wiki.extract);
        fill('language', wiki.language);
        fill('posterUrl', wiki.imageUrl);
      }
    } catch {
      // Wikipedia is optional.
    }

    const found = !!hit || next.links.some((l) => /wikipedia\.org/.test(l.url));
    return { ...next, fetchedAt: now(), updatedAt: now(), metadataStatus: found ? 'ok' : 'failed' };
  }

  /** Finds a trailer on YouTube for a title that has none (done when its details are opened). */
  async fetchTrailer(id: string): Promise<string> {
    const item = this.lib.items.find((i) => i.id === id);
    if (!item || item.trailerId || !this.fetchers) return item?.trailerId ?? '';
    const trailerId = await findTrailer(this.fetchers, item.originalTitle && !/^[\x00-\x7F]*$/.test(item.title) ? item.originalTitle : item.title, item.year, item.kind);
    if (trailerId) await this.update(id, { trailerId });
    return trailerId;
  }

  /** Everything, for a backup file. */
  exportJson(): string {
    return JSON.stringify({ format: 'tubemarks-media', version: 1, exportedAt: now(), items: this.lib.items }, null, 2);
  }

  /** Adds titles from a backup file; titles already saved are skipped. */
  async importJson(text: string): Promise<{ added: number; skipped: number }> {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file isn’t a movies and TV backup.');
    }
    const rows: any[] = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(rows)) throw new Error('That file isn’t a movies and TV backup.');
    const fresh: MediaItem[] = [];
    for (const r of rows) {
      if (!r || (r.kind !== 'movie' && r.kind !== 'tv') || !r.title) continue;
      const item = blankItem(r.kind, { ...r, id: crypto.randomUUID() });
      if (this.find(item) || fresh.some((i) => sameTitle(i, item))) continue;
      fresh.push(item);
    }
    await this.put(fresh);
    return { added: fresh.length, skipped: rows.length - fresh.length };
  }
}

function blankCandidate(kind: MediaKind): Candidate {
  return {
    source: 'wikipedia', kind, title: '', originalTitle: '', year: null, posterUrl: '', imdbId: '', imdbRating: null, imdbVotes: null,
    rtScore: null, synopsis: '', genres: [], runtime: null, seasons: null, justwatchPath: '', watch: [], trailerId: '', note: '',
  };
}
