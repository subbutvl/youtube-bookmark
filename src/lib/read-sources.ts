import { wikiPages, wikiUrl, wikiTitleFromUrl, type GameFetchers, type WikiPage } from './game-sources';
import type { Adaptation, AdaptationType, ReadKind } from './read-types';

/**
 * Where book, comic and magazine details come from, without API keys:
 * - Wikipedia (English, or Tamil for Tamil books): the article, its opening lines, its plot section and the cover.
 * - Wikidata (the article's data item): author, year, language, genre, publisher, Goodreads page and official site.
 * - Wikidata's query service: the films, TV shows and documentaries based on (or about) each work.
 * Every step is optional; anything can be filled in by hand.
 */
export type ReadFetchers = GameFetchers;
type Json = Record<string, any>;

const parseJson = (text: string): Json => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The answer wasn’t readable.');
  }
};

export async function sparql(f: ReadFetchers, query: string): Promise<Json[]> {
  const r = parseJson(await f.get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`));
  return r.results?.bindings ?? [];
}

const qidOf = (uri: string | undefined) => uri?.match(/Q\d+$/)?.[0] ?? '';

/** Everything a work's Wikidata item says that the app shows. Authors, genres and so on are item ids until labelled. */
export interface WorkFacts {
  qid: string;
  labelEn: string;
  labelTa: string;
  enwiki: string;
  tawiki: string;
  year: number | null;
  authorIds: string[];
  genreIds: string[];
  languageIds: string[];
  publisherIds: string[];
  goodreadsUrl: string;
  officialUrl: string;
}

const claimValues = (e: Json, prop: string): any[] =>
  ((e.claims?.[prop] ?? []) as Json[])
    .filter((c) => c.rank !== 'deprecated')
    .sort((a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred'))
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v) => v != null);
const ids = (e: Json, prop: string): string[] => claimValues(e, prop).map((v) => v.id).filter(Boolean);
const str = (e: Json, prop: string): string => {
  const v = claimValues(e, prop)[0];
  return typeof v === 'string' ? v : '';
};
const firstYear = (e: Json, ...props: string[]): number | null => {
  const years = props.flatMap((p) => claimValues(e, p)).map((v) => {
    const m = String(v.time ?? '').match(/^([+-])(\d{1,4})/);
    return m ? (m[1] === '-' ? -Number(m[2]) : Number(m[2])) : NaN;
  }).filter((y) => Number.isFinite(y) && y !== 0);
  return years.length ? Math.min(...years) : null;
};

/** Reads Wikidata items (50 at a time). */
export async function workFacts(f: ReadFetchers, qids: string[]): Promise<Map<string, WorkFacts>> {
  const out = new Map<string, WorkFacts>();
  const want = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < want.length; i += 50) {
    const url = `https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&props=claims|labels|sitelinks&languages=en|ta&sitefilter=enwiki|tawiki&ids=${want.slice(i, i + 50).join('|')}`;
    const r = parseJson(await f.get(url));
    for (const [qid, e] of Object.entries<Json>(r.entities ?? {})) {
      if (e.missing !== undefined) continue;
      const edition = str(e, 'P2969');
      const work = str(e, 'P8383');
      out.set(qid, {
        qid,
        labelEn: e.labels?.en?.value ?? '',
        labelTa: e.labels?.ta?.value ?? '',
        enwiki: e.sitelinks?.enwiki?.title ?? '',
        tawiki: e.sitelinks?.tawiki?.title ?? '',
        year: firstYear(e, 'P577', 'P571', 'P580'),
        authorIds: [...new Set([...ids(e, 'P50'), ...ids(e, 'P170')])],
        genreIds: ids(e, 'P136'),
        languageIds: ids(e, 'P407'),
        publisherIds: ids(e, 'P123'),
        goodreadsUrl: work ? `https://www.goodreads.com/work/editions/${work}` : edition ? `https://www.goodreads.com/book/show/${edition}` : '',
        officialUrl: str(e, 'P856'),
      });
    }
  }
  return out;
}

/** English labels of Wikidata items (Tamil when there's no English one). */
export async function labels(f: ReadFetchers, qids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const want = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < want.length; i += 50) {
    const r = parseJson(await f.get(`https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&props=labels&languages=en|ta&ids=${want.slice(i, i + 50).join('|')}`));
    for (const [qid, e] of Object.entries<Json>(r.entities ?? {})) {
      const label = e.labels?.en?.value ?? e.labels?.ta?.value;
      if (label) out.set(qid, label);
    }
  }
  return out;
}

/** What kind of work an adaptation is, from its type's name ("feature film", "television series"…). */
export function adaptationType(typeLabels: string[]): AdaptationType | null {
  const all = typeLabels.join(' | ').toLowerCase();
  if (/documentary/.test(all)) return 'documentary';
  if (/television|\btv\b|series|miniseries|serial|anime|season|web series/.test(all)) return 'tv';
  if (/film|movie/.test(all)) return 'movie';
  return null;
}

/**
 * Kinds of work kept as adaptations: films, TV series and documentaries. Anything else that's "based on" a book
 * (a radio play, an album, an opera, a video game) is left out.
 */
const SCREEN_TYPES = [
  'Q11424', // film
  'Q24862', // short film
  'Q506240', // television film
  'Q202866', // animated film
  'Q29168811', // animated feature film
  'Q226730', // silent film
  'Q93204', // documentary film
  'Q5398426', // television series
  'Q1259759', // miniseries
  'Q581714', // animated television series
  'Q63952888', // anime television series
  'Q526877', // web series
  'Q15416', // television program
  'Q3464665', // television series season
  'Q1261214', // television special
  'Q17517379', // animated short film
];

/** Films, TV shows and documentaries based on each work (or documentaries about it), 25 works per query. */
export async function adaptationsOf(f: ReadFetchers, qids: string[]): Promise<Map<string, Adaptation[]>> {
  const out = new Map<string, Adaptation[]>();
  const want = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < want.length; i += 25) {
    const rows = await sparql(f, `SELECT ?book ?ad ?adLabel ?typeLabel ?date ?article WHERE {
  VALUES ?book { ${want.slice(i, i + 25).map((q) => `wd:${q}`).join(' ')} }
  VALUES ?type { ${SCREEN_TYPES.map((q) => `wd:${q}`).join(' ')} }
  { ?ad wdt:P144 ?book } UNION { ?ad wdt:P921 ?book. ?ad wdt:P31 wd:Q93204 }
  ?ad wdt:P31 ?type.
  OPTIONAL { ?ad wdt:P577 ?date }
  OPTIONAL { ?article schema:about ?ad; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
    // One row per (adaptation, type, date): gather them per adaptation first.
    const byAd = new Map<string, { book: string; title: string; types: Set<string>; years: number[]; article: string }>();
    for (const b of rows) {
      const ad = qidOf(b.ad?.value);
      const book = qidOf(b.book?.value);
      if (!ad || !book) continue;
      const cur = byAd.get(`${book}/${ad}`) ?? { book, title: String(b.adLabel?.value ?? ''), types: new Set<string>(), years: [], article: '' };
      if (b.typeLabel?.value) cur.types.add(String(b.typeLabel.value));
      const y = Number(String(b.date?.value ?? '').slice(0, 4));
      if (y > 0) cur.years.push(y);
      if (b.article?.value) cur.article = String(b.article.value);
      byAd.set(`${book}/${ad}`, cur);
    }
    for (const a of byAd.values()) {
      const type = adaptationType([...a.types]);
      if (!type || !a.title || /^Q\d+$/.test(a.title)) continue;
      const list = out.get(a.book) ?? [];
      list.push({ title: a.title, type, year: a.years.length ? Math.min(...a.years) : null, wikiUrl: a.article });
      out.set(a.book, list);
    }
  }
  for (const list of out.values()) list.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
  return out;
}

const PLOT_HEADINGS = /^(plot|plot summary|synopsis|summary|story|storyline|premise|plot overview|overview|content|contents|story arc|plot and characters)$/i;

/** The plot section of a Wikipedia article as plain text ('' when it has none), cut to about 2,000 characters. */
export async function plotSection(f: ReadFetchers, wikiLink: string): Promise<string> {
  const title = wikiTitleFromUrl(wikiLink);
  if (!title) return '';
  const lang = wikiLink.match(/\/\/(\w+)\.wikipedia/)?.[1] ?? 'en';
  const r = parseJson(await f.get(`https://${lang}.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&action=query&redirects=1&prop=extracts&explaintext=1&exsectionformat=wiki&titles=${encodeURIComponent(title)}`));
  const text: string = r.query?.pages?.[0]?.extract ?? '';
  return pickPlot(text);
}

/** Finds the plot (or synopsis) section in an article's plain text. Exported for tests. */
export function pickPlot(text: string): string {
  const parts = `\n${text}`.split(/\n(={2,3})\s*([^=\n]+?)\s*\1\n/);
  // parts: [intro, level, heading, body, level, heading, body, …]
  for (let i = 1; i < parts.length; i += 3) {
    const heading = (parts[i + 1] ?? '').trim();
    if (!PLOT_HEADINGS.test(heading)) continue;
    let body = (parts[i + 2] ?? '').trim();
    // A plot section that's only a parent of sub-sections: take the first sub-section.
    if (!body && parts[i + 5] != null) body = parts[i + 5].trim();
    body = body.replace(/\n{2,}/g, '\n\n');
    if (body.length > 2000) {
      const cut = body.slice(0, 2000);
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
      body = `${cut.slice(0, end > 1000 ? end + 1 : 2000).trim()} …`;
    }
    return body;
  }
  return '';
}

/** Searches Wikipedia for a book, comic or magazine by name. */
export async function searchWorks(f: ReadFetchers, q: string, kind: ReadKind, n = 8): Promise<{ title: string; description: string; thumbUrl: string }[]> {
  const word = kind === 'magazine' ? 'magazine' : kind === 'comic' ? 'comic' : 'book';
  const r = parseJson(await f.get(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(`${q} ${word}`)}&limit=${n * 2}`));
  return ((r.pages ?? []) as Json[])
    .map((p) => ({
      title: String(p.title ?? ''),
      description: String(p.description ?? ''),
      thumbUrl: p.thumbnail?.url ? (String(p.thumbnail.url).startsWith('//') ? `https:${p.thumbnail.url}` : String(p.thumbnail.url)) : '',
    }))
    .filter((p) => isWorkPage(p, kind))
    .slice(0, n);
}

/** A page looks like it's about this kind of work (not a film of it, a person or a disambiguation page). */
export function isWorkPage(p: { title: string; description: string }, kind: ReadKind): boolean {
  const d = p.description;
  const t = p.title;
  if (/\((\d{4} )?(film|TV series|television series|miniseries|video game|album|song|play)\)$/i.test(t)) return false;
  if (/\b(film|television series|TV series|video game|disambiguation|album|song|band|footballer|politician|actor|actress|singer)\b/i.test(d)
    && !/\b(novel|book|comic|magazine|manga|strip|poem|epic|play)\b/i.test(d)) return false;
  if (kind === 'magazine') return /magazine|periodical|journal|weekly|monthly|publication|newspaper|zine/i.test(d) || /\(.*magazine\)$/i.test(t);
  if (kind === 'comic') return /comic|graphic novel|strip|cartoon|webcomic|anthology|storyline|story arc|crossover|limited series|maxi-?series|fictional|superhero|bande dessinée/i.test(d) || /\((comics?|comic book|comic strip|webcomic|graphic novel|[^)]*comics?)\)$/i.test(t);
  if (!d) return /\((novel|book|novella|poem|epic|[^)]* novel)\)$/i.test(t);
  return /novel|book|novella|memoir|poem|poetry|epic|short stor|non-?fiction|treatise|play\b|tragedy|comedy by|literary|literature|series of|essay|biography|autobiography|scripture|text|anthology|collection|fable|work by|written by|saga|kural|kavya|purana/i.test(d)
    || /\((novel|book|novella|poem|epic|play|[^)]* novel|[^)]* book)\)$/i.test(t);
}

/** True when the page's short description names this author ("1965 novel by Frank Herbert"), or names nobody. */
export function authorFits(description: string, authors: string): boolean {
  const by = description.match(/\bby (.+)$/i)?.[1];
  if (!by || !authors.trim()) return true;
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const said = fold(by);
  return authors.split(/,| and /).some((a) => {
    const words = fold(a).replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    const surname = words[words.length - 1];
    return !!surname && said.includes(surname);
  });
}

export { wikiPages, wikiUrl, wikiTitleFromUrl, type WikiPage };
