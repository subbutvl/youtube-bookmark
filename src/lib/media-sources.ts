import type { MediaItem, MediaKind, MediaLink, OfferType, WatchOption } from './media-types';
import { normTitle } from './media-types';
import { parseYouTubeUrl } from './youtube-url';

/**
 * Where movie and TV details come from, all without API keys:
 * - JustWatch (its site's GraphQL API): title, synopsis, poster, IMDb and Rotten Tomatoes scores, genres and where to watch.
 * - IMDb's search suggestions: used when JustWatch can't be reached or doesn't know a title.
 * - Wikidata and Wikipedia: the article, its summary and the original language.
 * - YouTube's search page: the trailer.
 * None of these are official APIs, so every step is optional and a title can always be filled in by hand.
 */
export interface MediaFetchers {
  /** GET, returns the body as text. */
  get: (url: string) => Promise<string>;
  /** POST a JSON body, returns the response body as text. */
  postJson: (url: string, body: string) => Promise<string>;
}

/** A search result, before it's saved. */
export interface Candidate {
  source: 'justwatch' | 'imdb' | 'wikipedia';
  kind: MediaKind;
  title: string;
  originalTitle: string;
  year: number | null;
  posterUrl: string;
  imdbId: string;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtScore: number | null;
  synopsis: string;
  genres: string[];
  runtime: number | null;
  seasons: number | null;
  justwatchPath: string;
  watch: WatchOption[];
  trailerId: string;
  /** Extra line for the results list, e.g. the stars. */
  note: string;
}

const JW = 'https://apis.justwatch.com/graphql';

const JW_FIELDS = `
  id objectType
  ... on Show { totalSeasonCount }
  content(country: $c, language: $l) {
    title originalTitle originalReleaseYear shortDescription posterUrl fullPath runtime
    genres { shortName }
    externalIds { imdbId }
    scoring { imdbScore imdbVotes tomatoMeter }
    clips { externalId provider }
  }
  offers(country: $c, platform: WEB) { monetizationType standardWebURL package { clearName } }`;

const SEARCH_QUERY = `query Search($c: Country!, $l: Language!, $q: String!, $t: [ObjectType!], $n: Int!) {
  popularTitles(country: $c, first: $n, filter: { searchQuery: $q, objectTypes: $t }) { edges { node { ${JW_FIELDS} } } }
}`;

const PATH_QUERY = `query Path($c: Country!, $l: Language!, $p: String!) {
  urlV2(fullPath: $p) { node { ... on MovieOrShow { ${JW_FIELDS} } } }
}`;

const GENRES: Record<string, string> = {
  act: 'Action', ani: 'Animation', cmy: 'Comedy', crm: 'Crime', doc: 'Documentary', drm: 'Drama', fml: 'Family', fnt: 'Fantasy',
  hst: 'History', hrr: 'Horror', msc: 'Music', rly: 'Reality', rma: 'Romance', scf: 'Sci-Fi', spt: 'Sport', trl: 'Thriller',
  war: 'War', wsn: 'Western', eur: 'Made in Europe',
};

const OFFER_TYPES: Record<string, OfferType> = { FLATRATE: 'stream', FREE: 'free', ADS: 'ads', FAST: 'ads', RENT: 'rent', BUY: 'buy' };

type Json = Record<string, any>;

function parseJson(text: string): Json {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The answer wasn’t readable.');
  }
}

export function jwPoster(path: string | null | undefined): string {
  if (!path) return '';
  return `https://images.justwatch.com${path.replace('{profile}', 's592').replace('{format}', 'webp')}`;
}

/** One entry per platform and offer type; the first link wins. */
export function jwOffers(offers: Json[] | null | undefined): WatchOption[] {
  const out: WatchOption[] = [];
  const seen = new Set<string>();
  for (const o of offers ?? []) {
    const type = OFFER_TYPES[o.monetizationType];
    const provider = o.package?.clearName;
    if (!type || !provider || !o.standardWebURL) continue;
    const key = `${provider}|${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ provider, url: o.standardWebURL, type, manual: false });
  }
  return out;
}

function fromJw(node: Json): Candidate | null {
  const c = node?.content;
  if (!c?.title) return null;
  const trailer = (c.clips ?? []).find((x: Json) => /youtube/i.test(x.provider ?? '') && x.externalId);
  return {
    source: 'justwatch',
    kind: node.objectType === 'SHOW' ? 'tv' : 'movie',
    title: c.title,
    originalTitle: c.originalTitle && c.originalTitle !== c.title ? c.originalTitle : '',
    year: c.originalReleaseYear ?? null,
    posterUrl: jwPoster(c.posterUrl),
    imdbId: c.externalIds?.imdbId ?? '',
    imdbRating: c.scoring?.imdbScore ?? null,
    imdbVotes: c.scoring?.imdbVotes ?? null,
    rtScore: c.scoring?.tomatoMeter ?? null,
    synopsis: c.shortDescription ?? '',
    genres: (c.genres ?? []).map((g: Json) => GENRES[g.shortName]).filter(Boolean),
    runtime: node.objectType === 'SHOW' ? null : c.runtime || null,
    seasons: node.totalSeasonCount ?? null,
    justwatchPath: c.fullPath ?? '',
    watch: jwOffers(node.offers),
    trailerId: trailer?.externalId ?? '',
    note: '',
  };
}

async function jw(f: MediaFetchers, query: string, variables: Json): Promise<Json> {
  const res = parseJson(await f.postJson(JW, JSON.stringify({ query, variables })));
  if (res.errors?.length && !res.data) throw new Error(`JustWatch: ${res.errors[0].message}`);
  return res.data ?? {};
}

export async function searchJustWatch(f: MediaFetchers, q: string, kind: MediaKind | null, country: string, n = 8): Promise<Candidate[]> {
  const t = kind === 'movie' ? ['MOVIE'] : kind === 'tv' ? ['SHOW'] : null;
  const data = await jw(f, SEARCH_QUERY, { c: country, l: 'en', q, t, n });
  return (data.popularTitles?.edges ?? []).map((e: Json) => fromJw(e.node)).filter(Boolean) as Candidate[];
}

export async function justWatchByPath(f: MediaFetchers, path: string, country: string): Promise<Candidate | null> {
  // A page from another country's site still names the same title.
  const p = path.replace(/^\/[a-z]{2}\//, `/${country.toLowerCase()}/`);
  try {
    const data = await jw(f, PATH_QUERY, { c: country, l: 'en', p });
    const hit = fromJw(data.urlV2?.node);
    if (hit || p === path) return hit;
  } catch (e) {
    if (p === path) throw e;
  }
  return fromJw((await jw(f, PATH_QUERY, { c: country, l: 'en', p: path })).urlV2?.node);
}

const IMDB_TV = new Set(['tvSeries', 'tvMiniSeries', 'tvSpecial', 'tvShort', 'podcastSeries']);
const IMDB_KINDS = new Set(['movie', 'tvMovie', 'short', 'video', ...IMDB_TV]);

/** IMDb's own search box suggestions: title, year, poster and id (no rating or synopsis). */
export async function searchImdb(f: MediaFetchers, q: string, kind: MediaKind | null): Promise<Candidate[]> {
  const key = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return [];
  const res = parseJson(await f.get(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(key)}.json?includeVideos=0`));
  const out: Candidate[] = [];
  for (const d of res.d ?? []) {
    if (!/^tt\d+$/.test(d.id ?? '') || !IMDB_KINDS.has(d.qid)) continue;
    const k: MediaKind = IMDB_TV.has(d.qid) ? 'tv' : 'movie';
    if (kind && k !== kind) continue;
    out.push({
      ...emptyCandidate('imdb', k),
      title: d.l ?? '',
      year: d.y ?? null,
      posterUrl: d.i?.imageUrl ? d.i.imageUrl.replace(/\._V1_.*\.jpg$/, '._V1_QL75_UX380_.jpg') : '',
      imdbId: d.id,
      note: d.s ?? '',
    });
  }
  return out;
}

function emptyCandidate(source: Candidate['source'], kind: MediaKind): Candidate {
  return {
    source, kind, title: '', originalTitle: '', year: null, posterUrl: '', imdbId: '', imdbRating: null, imdbVotes: null, rtScore: null,
    synopsis: '', genres: [], runtime: null, seasons: null, justwatchPath: '', watch: [], trailerId: '', note: '',
  };
}

/** Searches JustWatch, and IMDb when JustWatch fails or finds nothing. */
export async function searchTitles(f: MediaFetchers, q: string, kind: MediaKind | null, country: string): Promise<Candidate[]> {
  let first: unknown = null;
  try {
    const hits = await searchJustWatch(f, q, kind, country);
    if (hits.length) return hits;
  } catch (e) {
    first = e;
  }
  try {
    return await searchImdb(f, q, kind);
  } catch (e) {
    throw first ?? e;
  }
}

// ---------- Wikidata and Wikipedia ----------

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const TV_CLASSES = new Set(['Q5398426', 'Q1259759', 'Q581714', 'Q63952888', 'Q117467246', 'Q526877', 'Q15416', 'Q21191270']);

export interface ImdbTitle {
  title: string;
  year: number | null;
  kind: MediaKind;
  /** English Wikipedia article title, if there is one. */
  wikiTitle: string;
}

/** Looks an IMDb id up on Wikidata (IMDb's own pages refuse apps). */
export async function wikidataByImdb(f: MediaFetchers, imdbId: string): Promise<ImdbTitle | null> {
  const s = parseJson(await f.get(`${WIKIDATA}?action=query&list=search&srsearch=${encodeURIComponent(`haswbstatement:P345=${imdbId}`)}&format=json&origin=*`));
  const q = s.query?.search?.[0]?.title;
  if (!q) return null;
  const e = parseJson(await f.get(`${WIKIDATA}?action=wbgetentities&ids=${q}&props=labels|sitelinks|claims&languages=en&sitefilter=enwiki&format=json&origin=*`)).entities?.[q];
  if (!e) return null;
  const date: string = e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time ?? '';
  const classes: string[] = (e.claims?.P31 ?? []).map((c: Json) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  return {
    title: e.labels?.en?.value ?? '',
    year: /^[+-]?(\d{4})/.test(date) ? Number(date.match(/(\d{4})/)![1]) : null,
    kind: classes.some((c) => TV_CLASSES.has(c)) ? 'tv' : 'movie',
    wikiTitle: e.sitelinks?.enwiki?.title ?? '',
  };
}

export interface WikiSummary {
  title: string;
  url: string;
  extract: string;
  description: string;
  imageUrl: string;
  language: string;
}

/** Reads "a 2022 Indian Kannada-language film" style phrases. */
export function languageFromText(text: string): string {
  const m = text.match(/\b([A-Z][a-z]+)(?:\s+and\s+[A-Z][a-z]+)?-language\b/);
  return m ? m[1] : '';
}

const SCRIPTS: [RegExp, string][] = [
  [/[ಀ-೿]/, 'Kannada'], [/[ఀ-౿]/, 'Telugu'], [/[஀-௿]/, 'Tamil'], [/[ഀ-ൿ]/, 'Malayalam'],
  [/[ঀ-৿]/, 'Bengali'], [/[਀-੿]/, 'Punjabi'], [/[઀-૿]/, 'Gujarati'], [/[ऀ-ॿ]/, 'Hindi'],
  [/[぀-ヿ]/, 'Japanese'], [/[가-힯]/, 'Korean'], [/[一-鿿]/, 'Chinese'], [/[฀-๿]/, 'Thai'],
  [/[؀-ۿ]/, 'Arabic'], [/[Ѐ-ӿ]/, 'Russian'], [/[֐-׿]/, 'Hebrew'], [/[Ͱ-Ͽ]/, 'Greek'],
];

/** A guess from the original title's script (Kannada script → Kannada). Empty for Latin script. */
export function languageFromScript(title: string): string {
  for (const [re, name] of SCRIPTS) if (re.test(title)) return name;
  return '';
}

export async function wikiSummary(f: MediaFetchers, title: string): Promise<WikiSummary | null> {
  const r = parseJson(await f.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`));
  if (!r.title || r.type === 'disambiguation') return null;
  const extract: string = r.extract ?? '';
  return {
    title: r.title,
    url: r.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    extract,
    description: r.description ?? '',
    imageUrl: r.originalimage?.source ?? r.thumbnail?.source ?? '',
    language: languageFromText(extract) || languageFromText(r.description ?? ''),
  };
}

/** Finds the title's English Wikipedia article by search: a film or series page, from the right year when known. */
export async function findWikiArticle(f: MediaFetchers, title: string, year: number | null, kind: MediaKind): Promise<string> {
  const what = kind === 'tv' ? 'TV series' : 'film';
  const r = parseJson(await f.get(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(`${title} ${year ?? ''} ${what}`)}&limit=6`));
  const pages: Json[] = r.pages ?? [];
  const want = normTitle(title);
  const fits = (p: Json) => {
    const d = `${p.description ?? ''} ${(p.excerpt ?? '').replace(/<[^>]+>/g, '')}`;
    const isKind = kind === 'tv' ? /\b(series|television|TV|show|sitcom|anime|miniseries|documentary)\b/i.test(d) : /\bfilm\b|\bmovie\b/i.test(d);
    const nameOk = normTitle(String(p.title).replace(/\s*\([^)]*\)\s*$/, '')) === want;
    const yearOk = !year || d.includes(String(year)) || String(p.title).includes(String(year));
    return isKind && nameOk && yearOk;
  };
  return pages.find(fits)?.title ?? '';
}

// ---------- YouTube trailer ----------

function jsonText(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
}

/** The first trailer in YouTube's search results (the page is read; no API key needed). */
export function pickTrailer(html: string): string {
  const hits: { id: string; title: string }[] = [];
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,2000}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < 10) hits.push({ id: m[1], title: jsonText(m[2]) });
  return (hits.find((h) => /trailer|teaser|promo/i.test(h.title)) ?? hits[0])?.id ?? '';
}

export async function findTrailer(f: MediaFetchers, title: string, year: number | null, kind: MediaKind): Promise<string> {
  const q = `${title} ${year ?? ''} ${kind === 'tv' ? 'series' : ''} official trailer`.replace(/\s+/g, ' ');
  return pickTrailer(await f.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`));
}

// ---------- what was pasted ----------

export type MediaInput =
  | { kind: 'imdb'; imdbId: string; url: string }
  | { kind: 'justwatch'; path: string; url: string }
  | { kind: 'wiki'; title: string; url: string }
  | { kind: 'youtube'; videoId: string; url: string }
  | { kind: 'search'; query: string; year: number | null; url?: string }
  | { kind: 'url'; url: string };

const MEDIA_HOSTS = /(^|\.)(imdb\.com|rottentomatoes\.com|justwatch\.com|themoviedb\.org|letterboxd\.com|trakt\.tv)$/;

/** Sites that are only about movies and TV: links to them belong in Movies and TV Shows, not in Links. */
export function isMediaHost(host: string): boolean {
  return MEDIA_HOSTS.test(host.toLowerCase().replace(/^www\./, ''));
}

/** A Wikipedia article about a film or a series, judged by its title, e.g. Kantara_(2022_film). */
export function isMediaWikiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)wikipedia\.org$/.test(u.hostname)) return false;
    const t = decodeURIComponent(u.pathname.split('/wiki/')[1] ?? '');
    return /\((\d{4}_)?(\w+_)?(film|movie|TV_series|television_series|miniseries|web_series|series)\)$/i.test(t);
  } catch {
    return false;
  }
}

/** A link that belongs in Movies and TV Shows: a movie site, or a Wikipedia article about a film or series. */
export function isMediaUrl(url: string): boolean {
  try {
    return isMediaHost(new URL(url).hostname) || isMediaWikiUrl(url);
  } catch {
    return false;
  }
}

const slugWords = (s: string) => decodeURIComponent(s).replace(/[_-]+/g, ' ').replace(/\s+\d{4}$/, '').trim();

/** Works out what a pasted line points to: an IMDb, JustWatch, Wikipedia or YouTube page, or a name to search for. */
export function parseMediaInput(text: string): MediaInput {
  const t = text.trim();
  const tt = t.match(/\b(tt\d{6,10})\b/);
  if (tt && /imdb\.com|^tt\d/i.test(t)) return { kind: 'imdb', imdbId: tt[1], url: `https://www.imdb.com/title/${tt[1]}/` };
  let u: URL | null = null;
  try {
    if (/^https?:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+\//.test(t)) u = new URL(/^https?:/i.test(t) ? t : `https://${t}`);
  } catch {
    u = null;
  }
  if (!u) {
    const y = t.match(/^(.*\S)\s*\(?((?:19|20)\d{2})\)?$/);
    return y ? { kind: 'search', query: y[1], year: Number(y[2]) } : { kind: 'search', query: t, year: null };
  }
  const host = u.hostname.replace(/^www\./, '');
  const yt = parseYouTubeUrl(u.toString());
  if (yt && (yt.type === 'video' || yt.type === 'short')) return { kind: 'youtube', videoId: yt.youtubeId, url: u.toString() };
  if (/justwatch\.com$/.test(host) && /^\/[a-z]{2}\/[^/]+\/[^/]+/.test(u.pathname)) return { kind: 'justwatch', path: u.pathname.replace(/\/+$/, ''), url: u.toString() };
  if (/(^|\.)wikipedia\.org$/.test(host) && u.pathname.startsWith('/wiki/')) {
    return { kind: 'wiki', title: decodeURIComponent(u.pathname.slice(6)).replace(/_/g, ' '), url: u.toString() };
  }
  const slug = u.pathname.match(/^\/(?:m|tv)\/([^/]+)/) ?? u.pathname.match(/^\/(?:movie|tv|film|shows?)\/(?:\d+-)?([^/]+)/);
  if (slug && isMediaHost(host)) return { kind: 'search', query: slugWords(slug[1]), year: null, url: u.toString() };
  return { kind: 'url', url: u.toString() };
}

/** A link's label from its site. */
export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/imdb\.com$/.test(host)) return 'IMDb';
    if (/wikipedia\.org$/.test(host)) return 'Wikipedia';
    if (/rottentomatoes\.com$/.test(host)) return 'Rotten Tomatoes';
    if (/justwatch\.com$/.test(host)) return 'JustWatch';
    if (/youtube\.com$|youtu\.be$/.test(host)) return 'YouTube';
    if (/letterboxd\.com$/.test(host)) return 'Letterboxd';
    if (/themoviedb\.org$/.test(host)) return 'TMDB';
    return host;
  } catch {
    return url;
  }
}

export function addLink(links: MediaLink[], link: MediaLink): MediaLink[] {
  const key = (u: string) => u.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/+$/, '').toLowerCase();
  return links.some((l) => key(l.url) === key(link.url)) ? links : [...links, link];
}

/** Links shown for every title, worked out from what is known. */
export function standardLinks(item: Pick<MediaItem, 'title' | 'year' | 'kind' | 'imdbId' | 'justwatchPath'>): MediaLink[] {
  const q = `${item.title}${item.year ? ` ${item.year}` : ''}`;
  const out: MediaLink[] = [
    item.imdbId ? { label: 'IMDb', url: `https://www.imdb.com/title/${item.imdbId}/` } : { label: 'IMDb search', url: `https://www.imdb.com/find/?q=${encodeURIComponent(q)}` },
    { label: 'Rotten Tomatoes', url: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(item.title)}` },
    { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(`${q} ${item.kind === 'tv' ? 'TV series' : 'movie'}`)}` },
  ];
  if (item.justwatchPath) out.push({ label: 'JustWatch', url: `https://www.justwatch.com${item.justwatchPath}` });
  return out;
}
