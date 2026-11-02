import {
  findGameTrailer, genresFrom, isGamePage, originFrom, platformsFrom, sameName, searchGames, typesFrom, wikidataFacts, wikidataLabels,
  wikiPages, wikiTitleFromUrl, wikiUrl, type GameFacts, type GameFetchers, type WikiHit, type WikiPage,
} from './game-sources';
import { blankGame, GAME_TYPES, GENRES, normGame, PLATFORMS, sameGame, type Game, type GameLibrary, type GameType, type Genre, type Platform } from './game-types';
import { TOP_GAMES_TEXT } from './games-top';
import type { GameStorage } from './storage';

const now = () => new Date().toISOString();
/** Games looked up per round (one Wikipedia and one Wikidata request each). */
const BATCH = 20;

const isKey = <T extends string>(map: Record<T, string>) => (k: string): k is T => k in map;

let articles: Map<string, string> | null = null;
/** The Wikipedia article the starter list names for a game, when it isn't the game's name. */
function listedArticle(title: string): string {
  if (!articles) {
    articles = new Map();
    for (const line of TOP_GAMES_TEXT.trim().split('\n')) {
      const p = line.split('|').map((s) => s.trim());
      if (p[7]) articles.set(normGame(p[0]), p[7]);
    }
  }
  return articles.get(normGame(title)) ?? '';
}

/** The starter list, parsed. Rank is the place in the list. */
export function topGames(): Game[] {
  const base = Date.now();
  return TOP_GAMES_TEXT.trim().split('\n').map((line, i) => {
    const [title, year, platforms, genres, origin, types, hours] = line.split('|').map((s) => s.trim());
    // Earlier ranks get later times, so "Recently added" lists them in rank order.
    const at = new Date(base - i * 1000).toISOString();
    return blankGame({
      title,
      year: Number(year) || null,
      platforms: platforms.split(/\s+/).filter(isKey(PLATFORMS)),
      genres: genres.split(/\s+/).filter(isKey(GENRES)),
      origin,
      types: types.split(/\s+/).filter(isKey(GAME_TYPES)),
      hours: hours === '' ? null : Number(hours),
      rank: i + 1,
      metadataStatus: 'pending',
      createdAt: at,
      updatedAt: at,
    });
  });
}

export interface GameProgress {
  done: number;
  total: number;
}

/** A game picked from a search, before it's saved. */
export interface GameCandidate {
  title: string;
  description: string;
  thumbUrl: string;
}

/** The Games tab's library, kept in memory and written through to storage. */
export class GameStore {
  private lib: GameLibrary = { games: [] };
  private listeners = new Set<() => void>();
  /** Games being looked up right now. */
  fetching = new Set<string>();
  progress: GameProgress | null = null;

  constructor(private readonly storage: GameStorage, private readonly fetchers: GameFetchers | null) {}

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

  private need(): GameFetchers {
    if (!this.fetchers) throw new Error('Game details are looked up in the desktop app only.');
    return this.fetchers;
  }

  find(probe: Pick<Game, 'title' | 'year'>, exceptId?: string): Game | undefined {
    return this.lib.games.find((g) => g.id !== exceptId && sameGame(g, probe));
  }

  private async put(games: Game[]) {
    if (!games.length) return;
    await this.storage.save(games);
    const byId = new Map(this.lib.games.map((g) => [g.id, g]));
    for (const g of games) byId.set(g.id, g);
    this.lib.games = [...byId.values()];
    this.emit();
  }

  /** Adds the starter list (games already saved are skipped) and looks up their links. */
  async addTop(): Promise<{ added: number; skipped: number }> {
    const list = topGames();
    const fresh: Game[] = [];
    for (const g of list) {
      const have = this.find(g);
      if (have) {
        // Already saved by hand: give it its place in the list, and fill what's missing.
        if (have.rank == null) await this.put([fillBlank({ ...have, rank: g.rank }, g)]);
        continue;
      }
      fresh.push(g);
    }
    await this.put(fresh);
    void this.fetchDetails(fresh.map((g) => g.id));
    return { added: fresh.length, skipped: list.length - fresh.length };
  }

  /** Searches Wikipedia for games by name. */
  async search(q: string): Promise<GameCandidate[]> {
    const f = this.need();
    const t = q.trim();
    if (!t) return [];
    const fromUrl = wikiTitleFromUrl(t);
    if (fromUrl) {
      const page = (await wikiPages(f, [fromUrl])).get(fromUrl);
      return page ? [{ title: page.title, description: page.description, thumbUrl: page.imageUrl }] : [];
    }
    const hits: WikiHit[] = await searchGames(f, t);
    return hits.map((h) => ({ title: h.title, description: h.description, thumbUrl: h.thumbUrl }));
  }

  /** Saves the game a Wikipedia article is about, with everything Wikidata knows. */
  async addFromArticle(article: string): Promise<{ game: Game; existed: boolean }> {
    const f = this.need();
    const page = (await wikiPages(f, [article])).get(article);
    if (!page) throw new Error('Couldn’t read that Wikipedia article.');
    const facts = page.qid ? (await wikidataFacts(f, [page.qid])).get(page.qid) : undefined;
    const draft = await this.fromSources(page, facts, true);
    const existing = this.find(draft);
    if (existing) return { game: existing, existed: true };
    await this.put([draft]);
    return { game: draft, existed: false };
  }

  /** A new game filled from Wikipedia and Wikidata (platforms, genres and so on only when `full`). */
  private async fromSources(page: WikiPage, facts: GameFacts | undefined, full: boolean): Promise<Game> {
    const title = page.title.replace(/\s*\((\d{4} )?video game\)$/, '');
    const g = blankGame({ title, metadataStatus: 'ok', fetchedAt: now() });
    const filled = applyFacts(g, page, facts);
    if (!full || !facts || !this.fetchers) return filled;
    try {
      const labels = await wikidataLabels(this.fetchers, [...facts.platformIds, ...facts.genreIds, ...facts.modeIds, ...facts.developerIds, ...facts.countryIds]);
      const names = (qs: string[]) => qs.map((q) => labels.get(q) ?? '').filter(Boolean);
      return {
        ...filled,
        platforms: platformsFrom(names(facts.platformIds)),
        genres: genresFrom(names(facts.genreIds)),
        types: typesFrom(names(facts.modeIds)),
        developer: names(facts.developerIds).slice(0, 2).join(', '),
        origin: originFrom(names(facts.countryIds)),
      };
    } catch {
      return filled;
    }
  }

  /** Saves a game typed in by hand. */
  async addManual(game: Game): Promise<{ game: Game; existed: boolean }> {
    const existing = this.find(game);
    if (existing) return { game: existing, existed: true };
    const g = { ...game, title: game.title.trim(), createdAt: now(), updatedAt: now() };
    await this.put([g]);
    return { game: g, existed: false };
  }

  /** Changes a game. Throws if it would become the same as another saved game. */
  async update(id: string, patch: Partial<Game>) {
    const old = this.lib.games.find((g) => g.id === id);
    if (!old) return;
    const next = { ...old, ...patch, id, updatedAt: now() };
    const twin = 'title' in patch || 'year' in patch ? this.find(next, id) : undefined;
    if (twin) throw new Error(`That would duplicate “${twin.title}${twin.year ? ` (${twin.year})` : ''}”, which is already saved.`);
    await this.put([next]);
  }

  async remove(ids: string[]) {
    if (!ids.length) return;
    await this.storage.delete(ids);
    const drop = new Set(ids);
    this.lib.games = this.lib.games.filter((g) => !drop.has(g.id));
    this.emit();
  }

  /** Looks the games up: their Wikipedia article (cover, summary) and its Wikidata item (official site, IGN, trailer). */
  async fetchDetails(ids: string[]) {
    if (!this.fetchers) return;
    const f = this.fetchers;
    const todo = ids.filter((id) => !this.fetching.has(id));
    if (!todo.length) return;
    for (const id of todo) this.fetching.add(id);
    this.progress = { done: 0, total: (this.progress?.total ?? 0) - (this.progress?.done ?? 0) + todo.length };
    this.emit();
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.map((id) => this.lib.games.find((g) => g.id === id)).slice(i, i + BATCH).filter((g): g is Game => !!g);
      try {
        const found = await findArticles(f, batch);
        const facts = await wikidataFacts(f, [...found.values()].map((p) => p.qid)).catch(() => new Map<string, GameFacts>());
        const next = batch.map((g) => {
          const page = found.get(g.id);
          if (!page) return { ...g, metadataStatus: 'failed' as const, fetchedAt: now() };
          return { ...applyFacts(g, page, page.qid ? facts.get(page.qid) : undefined), metadataStatus: 'ok' as const, fetchedAt: now(), updatedAt: now() };
        });
        // The game may have been changed or deleted meanwhile: only write games still saved.
        await this.put(next.filter((g) => this.lib.games.some((x) => x.id === g.id)));
      } catch {
        const failed = batch.filter((g) => this.lib.games.some((x) => x.id === g.id)).map((g) => ({ ...g, metadataStatus: 'failed' as const, fetchedAt: now() }));
        await this.put(failed).catch(() => {});
      } finally {
        for (const g of batch) this.fetching.delete(g.id);
        if (this.progress) this.progress = { ...this.progress, done: this.progress.done + batch.length };
        if (this.progress && this.progress.done >= this.progress.total) this.progress = null;
        this.emit();
      }
    }
    // Games deleted before their turn.
    for (const id of todo) this.fetching.delete(id);
  }

  /** Finds a trailer on YouTube for a game that has none (done when its page is opened). */
  async fetchTrailer(id: string): Promise<string> {
    const g = this.lib.games.find((x) => x.id === id);
    if (!g || g.trailerId || !this.fetchers) return g?.trailerId ?? '';
    const trailerId = await findGameTrailer(this.fetchers, g.title, g.year);
    if (trailerId) await this.update(id, { trailerId });
    return trailerId;
  }

  /** Everything, for a backup file. */
  exportJson(): string {
    return JSON.stringify({ format: 'tubemarks-games', version: 1, exportedAt: now(), games: this.lib.games }, null, 2);
  }

  /** Adds games from a backup file; games already saved are skipped. */
  async importJson(text: string): Promise<{ added: number; skipped: number }> {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file isn’t a games backup.');
    }
    const rows: any[] = Array.isArray(data) ? data : data?.games;
    if (!Array.isArray(rows)) throw new Error('That file isn’t a games backup.');
    const fresh: Game[] = [];
    for (const r of rows) {
      if (!r || typeof r.title !== 'string' || !r.title.trim()) continue;
      const g = blankGame({ ...r, id: crypto.randomUUID() });
      if (this.find(g) || fresh.some((x) => sameGame(x, g))) continue;
      fresh.push(g);
    }
    await this.put(fresh);
    return { added: fresh.length, skipped: rows.length - fresh.length };
  }
}

/** Fills the game's empty fields from its article and Wikidata item; what's already there (or typed by hand) stays. */
export function applyFacts(g: Game, page: WikiPage, facts: GameFacts | undefined): Game {
  const next: Game = { ...g, wikiUrl: wikiUrl(page.title) };
  const fill = <K extends keyof Game>(k: K, v: Game[K] | null | undefined) => {
    const cur = next[k];
    if ((cur == null || cur === '') && v != null && v !== '') next[k] = v;
  };
  fill('summary', page.summary);
  fill('coverUrl', page.imageUrl);
  if (facts) {
    fill('officialUrl', facts.officialUrl);
    fill('ignUrl', facts.ignUrl);
    fill('trailerId', facts.trailerId);
    fill('year', facts.year);
    if (facts.hltbUrl && !next.links.some((l) => /howlongtobeat\.com/.test(l.url))) next.links = [...next.links, { label: 'HowLongToBeat', url: facts.hltbUrl }];
  }
  return next;
}

/** Copies list fields the other game has into the empty ones of this game. */
function fillBlank(g: Game, from: Game): Game {
  return {
    ...g,
    platforms: g.platforms.length ? g.platforms : from.platforms,
    genres: g.genres.length ? g.genres : from.genres,
    types: g.types.length ? g.types : from.types,
    origin: g.origin || from.origin,
    hours: g.hours ?? from.hours,
    year: g.year ?? from.year,
  };
}

/**
 * Each game's Wikipedia article: the one it names, else "Name (2015 video game)", else "Name (video game)", else a search.
 * Pages that aren't about a game (a film, a book, a franchise) are passed over.
 */
async function findArticles(f: GameFetchers, games: Game[]): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  const tries: ((g: Game) => string)[] = [
    (g) => wikiTitleFromUrl(g.wikiUrl) || listedArticle(g.title) || g.title,
    (g) => (g.year ? `${g.title} (${g.year} video game)` : ''),
    (g) => `${g.title} (video game)`,
  ];
  for (const name of tries) {
    const left = games.filter((g) => !out.has(g.id));
    const asked = left.map((g) => [g, name(g)] as const).filter(([, t]) => t);
    if (!asked.length) break;
    const pages = await wikiPages(f, [...new Set(asked.map(([, t]) => t))]);
    for (const [g, t] of asked) {
      const p = pages.get(t);
      // A page about something else (a film, a word, a whole series) is caught by its description.
      if (p && isGamePage(p)) out.set(g.id, p);
    }
  }
  for (const g of games.filter((x) => !out.has(x.id))) {
    try {
      const hit = (await searchGames(f, `${g.title} ${g.year ?? ''}`, 5)).find((h) => sameName(h.title, g.title));
      if (!hit) continue;
      const p = (await wikiPages(f, [hit.title])).get(hit.title);
      if (p && isGamePage(p)) out.set(g.id, p);
    } catch {
      // Try the next one.
    }
  }
  return out;
}

export type { Platform, Genre, GameType };
