import { pickTrailer } from './media-sources';
import { GAME_TYPES, GENRES, normGame, ORIGINS, PLATFORMS, type Game, type GameType, type Genre, type Platform } from './game-types';

/**
 * Where game details come from, without API keys:
 * - Wikipedia: the article, its short summary and the cover art.
 * - Wikidata (the article's data item): official website, IGN page, YouTube trailer, HowLongToBeat page,
 *   and for games added by hand also platforms, genres, game modes, developer and country.
 * - YouTube's search page: a trailer when Wikidata has none.
 * Every step is optional; a game can always be filled in by hand.
 */
export interface GameFetchers {
  /** GET, returns the body as text. */
  get: (url: string) => Promise<string>;
}

type Json = Record<string, any>;
const WP = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*';
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';

function parseJson(text: string): Json {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The answer wasn’t readable.');
  }
}

export const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
export const wikiTitleFromUrl = (url: string): string => {
  const m = url.match(/wikipedia\.org\/wiki\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : '';
};

export interface WikiPage {
  /** The article's title after redirects. */
  title: string;
  description: string;
  summary: string;
  imageUrl: string;
  qid: string;
}

/** A page looks like it's about a game (not a film, a series or a disambiguation page). */
export const isGamePage = (p: Pick<WikiPage, 'description' | 'title'>) =>
  /\(.*video game\)$/.test(p.title) || (/\bgame\b|video ?game|\bMMO|\bMOBA\b|\bsimulator\b/i.test(p.description) && !/\b(series|franchise|company|developer|character|film|engine)\b/i.test(p.description));

/** Looks up articles by exact title (up to 20 at once), following redirects. Returns them keyed by the title asked for. */
export async function wikiPages(f: GameFetchers, titles: string[]): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const url = `${WP}&action=query&redirects=1&prop=pageprops|pageimages|description|extracts&ppprop=wikibase_item|disambiguation&piprop=original|thumbnail&pithumbsize=600&pilicense=any&exintro=1&explaintext=1&exsentences=3&exlimit=20&titles=${encodeURIComponent(batch.join('|'))}`;
    const r = parseJson(await f.get(url));
    // Asked-for title → final title, through normalization and redirects.
    const hop = new Map<string, string>();
    for (const n of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])]) hop.set(n.from, n.to);
    const pages = new Map<string, Json>();
    for (const p of r.query?.pages ?? []) if (!p.missing && !p.invalid) pages.set(p.title, p);
    for (const t of batch) {
      let to = t;
      for (let n = 0; n < 4 && hop.has(to); n++) to = hop.get(to)!;
      const p = pages.get(to);
      if (!p || p.pageprops?.disambiguation !== undefined) continue;
      out.set(t, {
        title: p.title,
        description: p.description ?? '',
        summary: (p.extract ?? '').trim(),
        // The 600px thumbnail is plenty for a cover and much lighter than the original upload.
        imageUrl: p.thumbnail?.source ?? p.original?.source ?? '',
        qid: p.pageprops?.wikibase_item ?? '',
      });
    }
  }
  return out;
}

export interface WikiHit {
  title: string;
  description: string;
  thumbUrl: string;
}

/** Searches Wikipedia for games by name. */
export async function searchGames(f: GameFetchers, q: string, n = 8): Promise<WikiHit[]> {
  const r = parseJson(await f.get(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(`${q} video game`)}&limit=${n * 2}`));
  const hits: WikiHit[] = (r.pages ?? []).map((p: Json) => ({
    title: String(p.title ?? ''),
    description: String(p.description ?? ''),
    thumbUrl: p.thumbnail?.url ? (String(p.thumbnail.url).startsWith('//') ? `https:${p.thumbnail.url}` : String(p.thumbnail.url)) : '',
  }));
  return hits.filter((h) => isGamePage(h)).slice(0, n);
}

/** What Wikidata knows about a game. Platform, genre, mode, developer and country are labels, mapped later. */
export interface GameFacts {
  qid: string;
  officialUrl: string;
  ignUrl: string;
  trailerId: string;
  hltbUrl: string;
  year: number | null;
  platformIds: string[];
  genreIds: string[];
  modeIds: string[];
  developerIds: string[];
  countryIds: string[];
}

const claimValues = (e: Json, prop: string): any[] => {
  const all: Json[] = e.claims?.[prop] ?? [];
  // Preferred statements first, deprecated ones dropped.
  const live = all.filter((c) => c.rank !== 'deprecated').sort((a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred'));
  return live.map((c) => c.mainsnak?.datavalue?.value).filter((v) => v != null);
};
const ids = (e: Json, prop: string): string[] => claimValues(e, prop).map((v) => v.id).filter(Boolean);
const str = (e: Json, prop: string): string => {
  const v = claimValues(e, prop)[0];
  return typeof v === 'string' ? v : '';
};

/** Reads Wikidata items (up to 50 at once). */
export async function wikidataFacts(f: GameFetchers, qids: string[]): Promise<Map<string, GameFacts>> {
  const out = new Map<string, GameFacts>();
  const want = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < want.length; i += 50) {
    const r = parseJson(await f.get(`${WD}&action=wbgetentities&props=claims&ids=${want.slice(i, i + 50).join('|')}`));
    for (const [qid, e] of Object.entries<Json>(r.entities ?? {})) {
      if (e.missing !== undefined) continue;
      const ign = str(e, 'P5385');
      const hltb = str(e, 'P2816');
      const date = claimValues(e, 'P577').map((v) => String(v.time ?? '').match(/^[+-](\d{4})/)?.[1]).filter(Boolean).map(Number);
      out.set(qid, {
        qid,
        officialUrl: str(e, 'P856'),
        ignUrl: ign ? `https://www.ign.com/games/${ign}` : '',
        trailerId: str(e, 'P1651'),
        hltbUrl: hltb ? `https://howlongtobeat.com/game/${hltb}` : '',
        year: date.length ? Math.min(...date) : null,
        platformIds: ids(e, 'P400'),
        genreIds: ids(e, 'P136'),
        modeIds: ids(e, 'P404'),
        developerIds: ids(e, 'P178'),
        countryIds: ids(e, 'P495'),
      });
    }
  }
  return out;
}

/** English labels of Wikidata items. */
export async function wikidataLabels(f: GameFetchers, qids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const want = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < want.length; i += 50) {
    const r = parseJson(await f.get(`${WD}&action=wbgetentities&props=labels&languages=en&ids=${want.slice(i, i + 50).join('|')}`));
    for (const [qid, e] of Object.entries<Json>(r.entities ?? {})) {
      const label = e.labels?.en?.value;
      if (label) out.set(qid, label);
    }
  }
  return out;
}

// ---------- Wikidata labels to this app's filters ----------

const PLATFORM_RULES: [RegExp, Platform][] = [
  [/virtual reality|\bVR\b|quest|oculus|rift|vive|valve index|steamvr|mixed reality|pico/i, 'vr'],
  [/windows|linux|mac ?os|os x|steam ?os|personal computer|\bPC\b|steam deck|stadia/i, 'pc'],
  [/xbox/i, 'xb'],
  [/playstation (4|5)|ps[45]\b/i, 'ps'],
  [/\bios\b|ipad|iphone|android|mobile|fire os/i, 'mob'],
];
export function platformsFrom(labels: string[]): Platform[] {
  const out = new Set<Platform>();
  for (const l of labels) for (const [re, p] of PLATFORM_RULES) if (re.test(l)) out.add(p);
  return (Object.keys(PLATFORMS) as Platform[]).filter((p) => out.has(p));
}

const GENRE_RULES: [RegExp, Genre[]][] = [
  [/action[- ]adventure/i, ['act', 'adv']],
  [/action role-playing|action rpg/i, ['act', 'rpg']],
  [/role-playing|\bRPG\b/i, ['rpg']],
  [/shooter|first-person|third-person/i, ['fps']],
  [/strategy|4X|tower defense|wargame/i, ['str']],
  [/simulat|management|city-building|life sim|god game/i, ['sim']],
  [/sports?\b|football|soccer|basketball|golf|tennis|cricket|skateboard|wrestling|boxing/i, ['spo']],
  [/racing|driving/i, ['rac']],
  [/puzzle/i, ['puz']],
  [/platform/i, ['pla']],
  [/fighting|beat 'em up|hack and slash/i, ['fig']],
  [/horror/i, ['hor']],
  [/survival/i, ['sur']],
  [/sandbox/i, ['san']],
  [/stealth/i, ['ste']],
  [/open world/i, ['ow']],
  [/battle royale/i, ['br']],
  [/multiplayer online battle arena|\bMOBA\b/i, ['moba']],
  [/massively multiplayer|\bMMO/i, ['mmo']],
  [/roguelike|roguelite/i, ['rog']],
  [/metroidvania/i, ['mv']],
  [/rhythm|music video game|dance/i, ['rhy']],
  [/party/i, ['par']],
  [/card|deck-building/i, ['car']],
  [/^action|action game/i, ['act']],
  [/adventure/i, ['adv']],
];
export function genresFrom(labels: string[]): Genre[] {
  const out = new Set<Genre>();
  for (const l of labels) {
    const rule = GENRE_RULES.find(([re]) => re.test(l));
    for (const g of rule?.[1] ?? []) out.add(g);
  }
  return (Object.keys(GENRES) as Genre[]).filter((g) => out.has(g));
}

export function typesFrom(labels: string[]): GameType[] {
  const out = new Set<GameType>();
  for (const l of labels) {
    if (/single-player/i.test(l)) out.add('sp');
    if (/co-?op|cooperative/i.test(l)) out.add('co');
    else if (/multiplayer|online|player versus player|pvp/i.test(l)) out.add('mp');
    if (/free-to-play/i.test(l)) out.add('f2p');
  }
  return (Object.keys(GAME_TYPES) as GameType[]).filter((t) => out.has(t));
}

const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'US', 'united states of america': 'US', 'united kingdom': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
  "people's republic of china": 'CN', 'czech republic': 'CZ', 'south korea': 'KR', 'republic of korea': 'KR', 'turkey': 'TR',
  'kingdom of the netherlands': 'NL', 'taiwan': 'TW', 'republic of china': 'TW',
};
export function originFrom(labels: string[]): string {
  for (const l of labels) {
    const k = l.trim().toLowerCase();
    const code = COUNTRY_ALIASES[k] ?? Object.entries(ORIGINS).find(([, name]) => name.toLowerCase() === k)?.[0];
    if (code) return code;
  }
  return '';
}

// ---------- trailer ----------

/** The first game trailer in YouTube's search results. */
export async function findGameTrailer(f: GameFetchers, title: string, year: number | null): Promise<string> {
  const q = `${title} ${year ?? ''} official game trailer`.replace(/\s+/g, ' ');
  return pickTrailer(await f.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`));
}

// ---------- links shown on a game ----------

export interface ShownLink {
  label: string;
  url: string;
  /** False for search pages offered when the game has no link of that kind. */
  found: boolean;
}

/** The game's own links first, then searches for the ones it doesn't have. */
export function gameLinks(g: Pick<Game, 'title' | 'year' | 'officialUrl' | 'ignUrl' | 'wikiUrl' | 'links'>): ShownLink[] {
  const q = encodeURIComponent(g.title);
  const hltb = g.links.some((l) => /howlongtobeat\.com/.test(l.url));
  return [
    g.officialUrl ? { label: 'Official site', url: g.officialUrl, found: true } : null,
    g.ignUrl ? { label: 'IGN', url: g.ignUrl, found: true } : { label: 'Search IGN', url: `https://www.ign.com/search?q=${q}`, found: false },
    g.wikiUrl ? { label: 'Wikipedia', url: g.wikiUrl, found: true } : { label: 'Search Wikipedia', url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(`${g.title} video game`)}`, found: false },
    hltb ? null : { label: 'Search HowLongToBeat', url: `https://howlongtobeat.com/?q=${q}`, found: false },
  ].filter((l): l is ShownLink => !!l);
}

export const sameName = (a: string, b: string) => normGame(a.replace(/\s*\([^)]*\)\s*$/, '')) === normGame(b.replace(/\s*\([^)]*\)\s*$/, ''));
