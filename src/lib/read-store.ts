import { TOP_BOOKS_TEXT, TOP_TAMIL_BOOKS_TEXT } from './books-top';
import { TOP_COMICS_TEXT } from './comics-top';
import { TOP_MAGAZINES_TEXT } from './magazines-top';
import {
  adaptationsOf, authorFits, isWorkPage, labels, plotSection, searchWorks, wikiPages, wikiTitleFromUrl, wikiUrl, workFacts,
  type ReadFetchers, type WikiPage, type WorkFacts,
} from './read-sources';
import { blankRead, normRead, READ_NOUN, sameRead, type Adaptation, type ReadItem, type ReadKind, type ReadLibrary } from './read-types';
import type { ReadStorage } from './storage';

const now = () => new Date().toISOString();
/** Works looked up per round. */
const BATCH = 20;
/** Pause between batches, and waits before retrying a batch that failed. */
const PAUSE_MS = 1000;
const RETRY_WAITS = [5000, 20000, 60000];

const firstAuthor = (authors: string) => authors.split(/,| and /)[0]?.trim() ?? '';
const keyOf = (x: Pick<ReadItem, 'kind' | 'title' | 'authors'>) => `${x.kind}|${normRead(x.title)}|${normRead(firstAuthor(x.authors))}`;

/** Where the starter lists say each work's Wikipedia article is, when it isn't the title. */
interface Listed {
  wiki: string;
  /** Tamil Wikipedia title, for Tamil books. */
  tawiki: string;
}
let listedMap: Map<string, Listed> | null = null;
function listed(x: Pick<ReadItem, 'kind' | 'title' | 'authors'>): Listed | undefined {
  if (!listedMap) {
    listedMap = new Map();
    for (const item of topReads()) {
      const l = (item as ReadItem & { _listed?: Listed })._listed;
      if (l) listedMap.set(keyOf(item), l);
    }
  }
  return listedMap.get(keyOf(x));
}

const lines = (text: string) => text.trim().split('\n').map((l) => l.split('|').map((s) => s.trim()));

/** The starter lists, parsed: 1000 books (English, then Tamil), 1000 comics and 150 magazines. Rank is the place in each list. */
export function topReads(kind?: ReadKind): ReadItem[] {
  const base = Date.now();
  const out: ReadItem[] = [];
  const add = (k: ReadKind, rank: number, patch: Partial<ReadItem>, l: Listed) => {
    // Earlier ranks get later times, so "Recently added" lists them in rank order.
    const at = new Date(base - out.length * 1000).toISOString();
    const item = blankRead(k, { ...patch, rank, metadataStatus: 'pending', createdAt: at, updatedAt: at });
    if (l.wiki || l.tawiki) Object.defineProperty(item, '_listed', { value: l, enumerable: false });
    out.push(item);
  };
  if (!kind || kind === 'book') {
    let rank = 0;
    for (const [title, authors, year, wiki] of lines(TOP_BOOKS_TEXT)) add('book', ++rank, { title, authors, year: Number(year) || null, language: 'English' }, { wiki: wiki ?? '', tawiki: '' });
    for (const [title, authors, year, wiki, ta] of lines(TOP_TAMIL_BOOKS_TEXT)) {
      add('book', ++rank, { title, authors, year: Number(year) || null, language: 'Tamil', originalTitle: ta ?? '' }, { wiki: wiki ?? '', tawiki: ta ?? '' });
    }
  }
  if (!kind || kind === 'comic') {
    let rank = 0;
    for (const [title, authors, year, wiki] of lines(TOP_COMICS_TEXT)) add('comic', ++rank, { title, authors, year: Number(year) || null, language: 'English' }, { wiki: wiki ?? '', tawiki: '' });
  }
  if (!kind || kind === 'magazine') {
    let rank = 0;
    for (const [title, category, wiki] of lines(TOP_MAGAZINES_TEXT)) {
      add('magazine', ++rank, { title, category, language: category === 'Tamil weeklies' ? 'Tamil' : 'English' }, { wiki: wiki ?? '', tawiki: '' });
    }
  }
  return out;
}

export interface ReadProgress {
  done: number;
  total: number;
}

export interface ReadCandidate {
  title: string;
  description: string;
  thumbUrl: string;
}

/** The Books tab's library (books, comics and magazines), kept in memory and written through to storage. */
export class ReadStore {
  private lib: ReadLibrary = { items: [] };
  private listeners = new Set<() => void>();
  /** Works being looked up right now. */
  fetching = new Set<string>();
  progress: ReadProgress | null = null;
  /** Why the last lookup failed ('' when it worked). */
  lastError = '';
  private autoRetries = 0;
  /** Works whose plot was looked for this session. */
  private plotTried = new Set<string>();

  constructor(
    private readonly storage: ReadStorage,
    private readonly fetchers: ReadFetchers | null,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
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

  private need(): ReadFetchers {
    if (!this.fetchers) throw new Error('Details are looked up in the desktop app only.');
    return this.fetchers;
  }

  find(probe: Pick<ReadItem, 'kind' | 'title' | 'authors' | 'qid'>, exceptId?: string): ReadItem | undefined {
    return this.lib.items.find((x) => x.id !== exceptId && sameRead(x, probe));
  }

  private async put(items: ReadItem[]) {
    if (!items.length) return;
    await this.storage.save(items);
    const byId = new Map(this.lib.items.map((x) => [x.id, x]));
    for (const x of items) byId.set(x.id, x);
    this.lib.items = [...byId.values()];
    this.emit();
  }

  /** Adds a starter list (works already saved are skipped) and looks up their details. */
  async addTop(kind: ReadKind): Promise<{ added: number; skipped: number }> {
    const list = topReads(kind);
    const have = new Map<string, ReadItem>();
    for (const x of this.lib.items) {
      have.set(keyOf(x), x);
      have.set(keyOf({ ...x, authors: '' }), x);
    }
    const fresh: ReadItem[] = [];
    const ranked: ReadItem[] = [];
    for (const x of list) {
      const old = have.get(keyOf(x)) ?? have.get(keyOf({ ...x, authors: '' }));
      if (old) {
        if (old.rank == null) ranked.push({ ...old, rank: x.rank });
        continue;
      }
      have.set(keyOf(x), x);
      fresh.push(x);
    }
    await this.put([...ranked, ...fresh]);
    void this.fetchDetails(fresh.map((x) => x.id));
    return { added: fresh.length, skipped: list.length - fresh.length };
  }

  /** Searches Wikipedia by name. */
  async search(q: string, kind: ReadKind): Promise<ReadCandidate[]> {
    const f = this.need();
    const t = q.trim();
    if (!t) return [];
    const fromUrl = wikiTitleFromUrl(t);
    if (fromUrl) {
      const lang = t.match(/\/\/(\w+)\.wikipedia/)?.[1] ?? 'en';
      const page = (await wikiPages(f, [fromUrl], lang)).get(fromUrl);
      return page ? [{ title: lang === 'en' ? page.title : `${lang}:${page.title}`, description: page.description, thumbUrl: page.imageUrl }] : [];
    }
    return searchWorks(f, t, kind);
  }

  /** Saves the work a Wikipedia article is about, with what Wikidata knows. */
  async addFromArticle(article: string, kind: ReadKind): Promise<{ item: ReadItem; existed: boolean }> {
    const f = this.need();
    const lang = article.match(/^(\w{2,3}):/)?.[1] ?? 'en';
    const title = article.replace(/^\w{2,3}:/, '');
    const page = (await wikiPages(f, [title], lang)).get(title);
    if (!page) throw new Error('Couldn’t read that Wikipedia article.');
    const name = page.title.replace(/\s*\([^)]*\)$/, '');
    let item = blankRead(kind, { title: name, metadataStatus: 'ok', fetchedAt: now() });
    item = await this.enrich(f, [[item, { page, lang }]]).then((m) => m.get(item.id) ?? item);
    const existing = this.find(item);
    if (existing) return { item: existing, existed: true };
    await this.put([item]);
    return { item, existed: false };
  }

  /** Saves a work typed in by hand. */
  async addManual(item: ReadItem): Promise<{ item: ReadItem; existed: boolean }> {
    const existing = this.find(item);
    if (existing) return { item: existing, existed: true };
    const x = { ...item, title: item.title.trim(), createdAt: now(), updatedAt: now() };
    await this.put([x]);
    return { item: x, existed: false };
  }

  /** Changes a work. Throws if it would become the same as another saved one. */
  async update(id: string, patch: Partial<ReadItem>) {
    const old = this.lib.items.find((x) => x.id === id);
    if (!old) return;
    const next = { ...old, ...patch, id, updatedAt: now() };
    const twin = 'title' in patch || 'authors' in patch ? this.find({ ...next, qid: '' }, id) : undefined;
    if (twin) throw new Error(`That would duplicate “${twin.title}”, which is already saved.`);
    await this.put([next]);
  }

  async remove(ids: string[]) {
    if (!ids.length) return;
    await this.storage.delete(ids);
    const drop = new Set(ids);
    this.lib.items = this.lib.items.filter((x) => !drop.has(x.id));
    this.emit();
  }

  /** Fills works from Wikidata (author, year, Goodreads…) and their adaptations, given each one's article. */
  private async enrich(f: ReadFetchers, found: [ReadItem, { page: WikiPage; lang: string }][]): Promise<Map<string, ReadItem>> {
    const qids = found.map(([, p]) => p.page.qid).filter(Boolean);
    const retry = async <T>(run: () => Promise<T>, empty: T): Promise<T> => {
      try {
        return await run();
      } catch {
        await this.sleep(RETRY_WAITS[0]);
        return run().catch(() => empty);
      }
    };
    const facts = qids.length ? await retry(() => workFacts(f, qids), new Map<string, WorkFacts>()) : new Map<string, WorkFacts>();
    const ids = [...facts.values()].flatMap((x) => [...x.authorIds.slice(0, 4), ...x.genreIds.slice(0, 4), ...x.languageIds.slice(0, 2), ...x.publisherIds.slice(0, 1)]);
    const names = ids.length ? await retry(() => labels(f, ids), new Map<string, string>()) : new Map<string, string>();
    // Adaptations only for books and comics (a magazine's "based on" items are rarely screen work).
    const adaptQids = found.filter(([x, p]) => x.kind !== 'magazine' && p.page.qid).map(([, p]) => p.page.qid);
    const ads = adaptQids.length ? await retry(() => adaptationsOf(f, adaptQids), null) : new Map<string, Adaptation[]>();
    const out = new Map<string, ReadItem>();
    for (const [x, p] of found) {
      const fx = p.page.qid ? facts.get(p.page.qid) : undefined;
      out.set(x.id, applyFacts(x, p.page, p.lang, fx, names, ads ? ads.get(p.page.qid) ?? [] : null));
    }
    return out;
  }

  /** Looks the works up: Wikipedia article (cover, summary), Wikidata (author, Goodreads…) and screen adaptations. */
  async fetchDetails(ids: string[]) {
    if (!this.fetchers) return;
    const f = this.fetchers;
    const todo = ids.filter((id) => !this.fetching.has(id));
    if (!todo.length) return;
    for (const id of todo) this.fetching.add(id);
    this.progress = { done: 0, total: (this.progress?.total ?? 0) - (this.progress?.done ?? 0) + todo.length };
    this.lastError = '';
    this.emit();
    const refused: string[] = [];
    for (let i = 0; i < todo.length; i += BATCH) {
      const giveUp = !!this.lastError && i > 0;
      const batch = todo.slice(i, i + BATCH).map((id) => this.lib.items.find((x) => x.id === id)).filter((x): x is ReadItem => !!x);
      try {
        if (giveUp) throw new Error(this.lastError);
        let found: Map<string, { page: WikiPage; lang: string }> | null = null;
        for (let attempt = 0; !found; attempt++) {
          try {
            found = await findArticles(f, batch);
          } catch (e) {
            if (attempt >= RETRY_WAITS.length) throw e;
            await this.sleep(RETRY_WAITS[attempt]);
          }
        }
        const enriched = await this.enrich(f, batch.filter((x) => found!.has(x.id)).map((x) => [x, found!.get(x.id)!]));
        const next = batch.map((x) => enriched.get(x.id) ?? { ...x, metadataStatus: 'failed' as const, fetchedAt: now() });
        // The work may have been changed or deleted meanwhile: only write works still saved, keeping what was typed since.
        await this.put(next.flatMap((x) => {
          const cur = this.lib.items.find((y) => y.id === x.id);
          if (!cur) return [];
          return [{ ...x, status: cur.status, myRating: cur.myRating, notes: cur.notes }];
        }));
        this.lastError = '';
      } catch (e) {
        if (!giveUp) this.lastError = e instanceof Error ? e.message : String(e);
        refused.push(...batch.map((x) => x.id));
        const failed = batch.filter((x) => this.lib.items.some((y) => y.id === x.id)).map((x) => ({ ...x, metadataStatus: 'failed' as const, fetchedAt: now() }));
        await this.put(failed).catch(() => {});
      } finally {
        for (const x of batch) this.fetching.delete(x.id);
        if (this.progress) this.progress = { ...this.progress, done: this.progress.done + batch.length };
        if (this.progress && this.progress.done >= this.progress.total) this.progress = null;
        this.emit();
      }
      if (i + BATCH < todo.length && !this.lastError) await this.sleep(PAUSE_MS);
    }
    for (const id of todo) this.fetching.delete(id);
    if (refused.length && this.autoRetries < 3) {
      this.autoRetries++;
      setTimeout(() => void this.fetchDetails(refused.filter((id) => this.lib.items.some((x) => x.id === id && x.metadataStatus === 'failed'))), 2 * 60_000);
    }
  }

  /** Reads the plot section of a work's article, once per session, when it's opened and has none. */
  async fetchSynopsis(id: string): Promise<string> {
    const x = this.lib.items.find((y) => y.id === id);
    if (!x || x.synopsis || !x.wikiUrl || !this.fetchers || this.plotTried.has(id) || x.kind === 'magazine') return x?.synopsis ?? '';
    this.plotTried.add(id);
    const synopsis = await plotSection(this.fetchers, x.wikiUrl).catch(() => '');
    if (synopsis) await this.update(id, { synopsis });
    return synopsis;
  }

  /** Everything, for a backup file. */
  exportJson(): string {
    return JSON.stringify({ format: 'tubemarks-reading', version: 1, exportedAt: now(), items: this.lib.items }, null, 2);
  }

  /** Adds works from a backup file; works already saved are skipped. */
  async importJson(text: string): Promise<{ added: number; skipped: number }> {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file isn’t a books backup.');
    }
    const rows: any[] = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(rows)) throw new Error('That file isn’t a books backup.');
    const fresh: ReadItem[] = [];
    for (const r of rows) {
      if (!r || typeof r.title !== 'string' || !r.title.trim() || !(r.kind in READ_NOUN)) continue;
      const x = blankRead(r.kind, { ...r, id: crypto.randomUUID() });
      if (this.find(x) || fresh.some((y) => sameRead(y, x))) continue;
      fresh.push(x);
    }
    await this.put(fresh);
    return { added: fresh.length, skipped: rows.length - fresh.length };
  }
}

/** Fills the work's empty fields from its article and Wikidata item; what's already there (or typed by hand) stays. */
export function applyFacts(
  x: ReadItem, page: WikiPage, lang: string, facts: WorkFacts | undefined, names: Map<string, string>, adaptations: Adaptation[] | null,
): ReadItem {
  const next: ReadItem = { ...x, wikiUrl: wikiUrl(page.title, lang), metadataStatus: 'ok', fetchedAt: now(), updatedAt: now() };
  const fill = <K extends keyof ReadItem>(k: K, v: ReadItem[K] | null | undefined) => {
    const cur = next[k];
    if ((cur == null || cur === '') && v != null && v !== '') next[k] = v;
  };
  const named = (qs: string[], n: number) => qs.map((q) => names.get(q) ?? '').filter(Boolean).slice(0, n);
  fill('summary', page.summary);
  fill('coverUrl', page.imageUrl);
  if (facts) {
    // A Tamil book's English article may be on Tamil Wikipedia only; prefer English Wikipedia when the item has one.
    if (lang !== 'en' && facts.enwiki) next.wikiUrl = wikiUrl(facts.enwiki);
    fill('qid', facts.qid);
    fill('year', facts.year);
    fill('authors', named(facts.authorIds, 4).join(', '));
    fill('publisher', named(facts.publisherIds, 1).join(''));
    fill('language', named(facts.languageIds, 1).join(''));
    fill('goodreadsUrl', facts.goodreadsUrl);
    fill('officialUrl', facts.officialUrl);
    if (next.language === 'Tamil') fill('originalTitle', facts.labelTa);
    if (!next.genres.length) next.genres = named(facts.genreIds, 3).map((g) => g.replace(/^./, (c) => c.toUpperCase()));
  }
  if (adaptations && adaptations.length) next.adaptations = adaptations;
  return next;
}

/** Wikipedia titles to try for a work, in order (after the one the list names). */
function guesses(x: ReadItem): string[] {
  const t = x.title;
  const surname = firstAuthor(x.authors).split(/\s+/).pop() ?? '';
  if (x.kind === 'magazine') return [t, `${t} (magazine)`];
  if (x.kind === 'comic') return [t, `${t} (comics)`, `${t} (comic book)`, `${t} (comic strip)`, `${t} (webcomic)`, `${t} (graphic novel)`];
  return [t, `${t} (novel)`, surname ? `${t} (${surname} novel)` : '', `${t} (book)`, `${t} (poem)`, `${t} (play)`].filter(Boolean);
}

/**
 * Each work's Wikipedia article: the one the list (or the work) names, else the title and the usual "(novel)",
 * "(comics)" or "(magazine)" forms, else Tamil Wikipedia for Tamil books, else a search.
 * Pages about something else (a film, a person, a word) are passed over, and so are novels by someone else.
 */
async function findArticles(f: ReadFetchers, items: ReadItem[]): Promise<Map<string, { page: WikiPage; lang: string }>> {
  const out = new Map<string, { page: WikiPage; lang: string }>();
  const fits = (x: ReadItem, p: WikiPage) => isWorkPage(p, x.kind) && (x.kind !== 'book' || authorFits(p.description, x.authors));
  // 1. The article the work or the list names (trusted).
  const named = items.map((x) => [x, wikiTitleFromUrl(x.wikiUrl) || listed(x)?.wiki || ''] as const).filter(([, t]) => t);
  if (named.length) {
    const pages = await wikiPages(f, [...new Set(named.map(([, t]) => t))]);
    for (const [x, t] of named) {
      const p = pages.get(t);
      if (p && (x.wikiUrl || !/\b(film|television series|video game)\b/i.test(p.description))) out.set(x.id, { page: p, lang: 'en' });
    }
  }
  // 2. Guessed titles, one guess per round so the likeliest wins.
  for (let round = 0; round < 6; round++) {
    const asked = items.filter((x) => !out.has(x.id)).map((x) => [x, guesses(x)[round] ?? ''] as const).filter(([, t]) => t);
    if (!asked.length) break;
    const pages = await wikiPages(f, [...new Set(asked.map(([, t]) => t))]);
    for (const [x, t] of asked) {
      const p = pages.get(t);
      if (p && fits(x, p)) out.set(x.id, { page: p, lang: 'en' });
    }
  }
  // 3. Tamil Wikipedia, by the Tamil title.
  const tamil = items.filter((x) => !out.has(x.id) && (listed(x)?.tawiki || (x.language === 'Tamil' && x.originalTitle)));
  if (tamil.length) {
    const titleOf = (x: ReadItem) => listed(x)?.tawiki || x.originalTitle;
    const pages = await wikiPages(f, [...new Set(tamil.map(titleOf))], 'ta');
    for (const x of tamil) {
      const p = pages.get(titleOf(x));
      if (p) out.set(x.id, { page: p, lang: 'ta' });
    }
  }
  // 4. A search, one work at a time.
  for (const x of items.filter((y) => !out.has(y.id))) {
    try {
      const hits = await searchWorks(f, `${x.title} ${firstAuthor(x.authors)}`.trim(), x.kind, 5);
      const hit = hits.find((h) => normRead(h.title.replace(/\s*\([^)]*\)$/, '')) === normRead(x.title));
      if (!hit) continue;
      const p = (await wikiPages(f, [hit.title])).get(hit.title);
      if (p && fits(x, p)) out.set(x.id, { page: p, lang: 'en' });
    } catch {
      // Try the next one.
    }
  }
  return out;
}
