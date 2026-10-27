/** Movies and TV shows live in their own library, apart from YouTube, Links and Wikipedia. */
export type MediaKind = 'movie' | 'tv';
export const KIND_LABELS: Record<MediaKind, string> = { movie: 'Movies', tv: 'TV Shows' };
export const KIND_NOUN: Record<MediaKind, string> = { movie: 'movie', tv: 'TV show' };

export type WatchStatus = 'none' | 'want' | 'watching' | 'watched';
export const STATUS_LABELS: Record<WatchStatus, string> = { none: 'No status', want: 'Want to watch', watching: 'Watching', watched: 'Watched' };

/** How a platform offers the title. */
export type OfferType = 'stream' | 'free' | 'ads' | 'rent' | 'buy' | 'other';
export const OFFER_LABELS: Record<OfferType, string> = { stream: 'Subscription', free: 'Free', ads: 'Free with ads', rent: 'Rent', buy: 'Buy', other: 'Other' };

/** Where to watch: a platform and the title's page on it. */
export interface WatchOption {
  provider: string;
  url: string;
  type: OfferType;
  /** Typed in by hand; kept when details are fetched again. */
  manual: boolean;
}

/** A page about the title (IMDb, Wikipedia, a review…). Stored with the title, never in the Links tab. */
export interface MediaLink {
  label: string;
  url: string;
}

export type MediaStatus = 'pending' | 'ok' | 'failed' | 'manual';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  /** English (or the platform's) title. */
  title: string;
  /** Title in its own language and script, when different. */
  originalTitle: string;
  year: number | null;
  /** e.g. Hindi, Kannada, Japanese. */
  language: string;
  synopsis: string;
  posterUrl: string;
  /** tt1375666 */
  imdbId: string;
  /** Out of 10. */
  imdbRating: number | null;
  imdbVotes: number | null;
  /** Rotten Tomatoes Tomatometer, 0–100. */
  rtScore: number | null;
  genres: string[];
  /** Minutes (movies). */
  runtime: number | null;
  /** Number of seasons (TV shows). */
  seasons: number | null;
  /** YouTube video id of the trailer. */
  trailerId: string;
  links: MediaLink[];
  watch: WatchOption[];
  /** JustWatch page path, e.g. /in/movie/inception; used to fetch details again. */
  justwatchPath: string;
  status: WatchStatus;
  /** Your own rating out of 10. */
  myRating: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  fetchedAt: string | null;
  metadataStatus: MediaStatus;
}

export interface MediaLibrary {
  items: MediaItem[];
}

export function blankItem(kind: MediaKind, patch: Partial<MediaItem> = {}): MediaItem {
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    title: '',
    originalTitle: '',
    year: null,
    language: '',
    synopsis: '',
    posterUrl: '',
    imdbId: '',
    imdbRating: null,
    imdbVotes: null,
    rtScore: null,
    genres: [],
    runtime: null,
    seasons: null,
    trailerId: '',
    links: [],
    watch: [],
    justwatchPath: '',
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

/** Platforms offered when adding one by hand; any other name can be typed. */
export const COMMON_PROVIDERS = [
  'Netflix', 'Amazon Prime Video', 'JioHotstar', 'Disney+', 'Apple TV+', 'Sony LIV', 'ZEE5', 'Sun NXT', 'aha', 'MX Player',
  'Hoichoi', 'ManoramaMAX', 'YouTube', 'Google TV', 'Max', 'Hulu', 'Crunchyroll', 'MUBI', 'Lionsgate Play', 'Airtel Xstream',
];

/** Countries JustWatch can tell availability for (the app asks for one). */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'AE', name: 'UAE' }, { code: 'SG', name: 'Singapore' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
];

const at = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^\p{L}\p{N}]+/gu, '');
/** Same title for spotting duplicates: the IMDb id when known, else name and year. */
export function sameTitle(a: Pick<MediaItem, 'kind' | 'imdbId' | 'title' | 'year'>, b: Pick<MediaItem, 'kind' | 'imdbId' | 'title' | 'year'>): boolean {
  if (a.imdbId && b.imdbId) return a.imdbId === b.imdbId;
  return a.kind === b.kind && at(a.title) === at(b.title) && (a.year == null || b.year == null || a.year === b.year);
}
export const normTitle = at;
