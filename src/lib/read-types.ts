/** Books, comics and magazines live in their own library; their links never go to Links, YouTube or Wikipedia. */

export type ReadKind = 'book' | 'comic' | 'magazine';
export const READ_KINDS: ReadKind[] = ['book', 'comic', 'magazine'];
export const READ_LABELS: Record<ReadKind, string> = { book: 'Books', comic: 'Comics', magazine: 'Magazines' };
export const READ_NOUN: Record<ReadKind, string> = { book: 'book', comic: 'comic', magazine: 'magazine' };

export type ReadStatus = 'none' | 'want' | 'reading' | 'read' | 'dropped';
export const READ_STATUS_LABELS: Record<ReadStatus, string> = { none: 'No status', want: 'Want to read', reading: 'Reading', read: 'Read', dropped: 'Dropped' };

/** What a book was turned into. */
export type AdaptationType = 'movie' | 'tv' | 'documentary' | 'other';
export const ADAPTATION_LABELS: Record<AdaptationType, string> = { movie: 'Movie', tv: 'TV show', documentary: 'Documentary', other: 'Other' };

export interface Adaptation {
  title: string;
  type: AdaptationType;
  year: number | null;
  /** Its Wikipedia article, when there is one. */
  wikiUrl: string;
}

export interface ReadLink {
  label: string;
  url: string;
}

export type ReadMetaStatus = 'pending' | 'ok' | 'failed' | 'manual';

export interface ReadItem {
  id: string;
  kind: ReadKind;
  /** English title (or the title in its own language when there's no English one). */
  title: string;
  /** Title in its own language and script, e.g. பொன்னியின் செல்வன். */
  originalTitle: string;
  /** Writers (and artists, for comics), comma separated. */
  authors: string;
  year: number | null;
  /** e.g. English, Tamil. */
  language: string;
  genres: string[];
  /** Magazines: Movies, Travel… */
  category: string;
  publisher: string;
  /** Wikipedia's opening lines about it. */
  summary: string;
  /** The story: Wikipedia's plot section, read when the book is first opened. */
  synopsis: string;
  coverUrl: string;
  wikiUrl: string;
  goodreadsUrl: string;
  /** The magazine's (or book's) own site. */
  officialUrl: string;
  adaptations: Adaptation[];
  /** Other pages about it. Kept here, never in the Links tab. */
  links: ReadLink[];
  /** Wikidata item, e.g. Q43361; used to look details up again. */
  qid: string;
  /** Place in its starter list (1 = best known); null for ones added by hand. */
  rank: number | null;
  status: ReadStatus;
  myRating: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  fetchedAt: string | null;
  metadataStatus: ReadMetaStatus;
}

export interface ReadLibrary {
  items: ReadItem[];
}

export function blankRead(kind: ReadKind, patch: Partial<ReadItem> = {}): ReadItem {
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    title: '',
    originalTitle: '',
    authors: '',
    year: null,
    language: '',
    genres: [],
    category: '',
    publisher: '',
    summary: '',
    synopsis: '',
    coverUrl: '',
    wikiUrl: '',
    goodreadsUrl: '',
    officialUrl: '',
    adaptations: [],
    links: [],
    qid: '',
    rank: null,
    status: 'none',
    myRating: null,
    notes: '',
    createdAt: at,
    updatedAt: at,
    fetchedAt: null,
    metadataStatus: 'manual',
    ...patch,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^\p{L}\p{N}]+/gu, '');
export const normRead = norm;

/** Same book, comic or magazine: the same Wikidata item, else the same kind and name (and author, when both are known). */
export function sameRead(a: Pick<ReadItem, 'kind' | 'title' | 'authors' | 'qid'>, b: Pick<ReadItem, 'kind' | 'title' | 'authors' | 'qid'>): boolean {
  if (a.qid && b.qid) return a.qid === b.qid;
  if (a.kind !== b.kind || norm(a.title) !== norm(b.title)) return false;
  const first = (s: string) => norm(s.split(',')[0] ?? '');
  return !a.authors || !b.authors || first(a.authors) === first(b.authors);
}

/** Magazine categories: the seven asked for, then the recommended ones. */
export const MAGAZINE_CATEGORIES = [
  'Movies', 'TV shows', 'Photography', 'Hobbies', 'Space', 'Travel', 'Food',
  'Science', 'Technology', 'Design', 'Music', 'Gaming', 'Ideas & news', 'Tamil weeklies', 'Nature',
] as const;

/** Goodreads: the work's page when known, else a search. */
export function goodreadsLink(item: Pick<ReadItem, 'title' | 'authors' | 'goodreadsUrl'>): { url: string; found: boolean } {
  if (item.goodreadsUrl) return { url: item.goodreadsUrl, found: true };
  const q = `${item.title} ${item.authors.split(',')[0] ?? ''}`.trim();
  return { url: `https://www.goodreads.com/search?q=${encodeURIComponent(q)}`, found: false };
}
