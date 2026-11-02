/** Games live in their own library; their links (official site, IGN, Wikipedia, trailer) never go to Links, YouTube or Wikipedia. */

export const PLATFORMS = { pc: 'PC', xb: 'Xbox', ps: 'PS4 / PS5', vr: 'VR', mob: 'Mobile' } as const;
export type Platform = keyof typeof PLATFORMS;

export const GENRES = {
  act: 'Action', adv: 'Adventure', rpg: 'RPG', fps: 'Shooter', str: 'Strategy', sim: 'Simulation', spo: 'Sports', rac: 'Racing',
  puz: 'Puzzle', pla: 'Platformer', fig: 'Fighting', hor: 'Horror', sur: 'Survival', san: 'Sandbox', ste: 'Stealth', ow: 'Open world',
  br: 'Battle royale', moba: 'MOBA', mmo: 'MMO', rog: 'Roguelike', mv: 'Metroidvania', rhy: 'Rhythm', par: 'Party', car: 'Card',
} as const;
export type Genre = keyof typeof GENRES;

/** How it's played: alone, against others, together, and whether it's free. */
export const GAME_TYPES = { sp: 'Single-player', mp: 'Multiplayer', co: 'Co-op', f2p: 'Free to play' } as const;
export type GameType = keyof typeof GAME_TYPES;

/** Countries the lead developer can be from (ISO codes); any other code shows as typed. */
export const ORIGINS: Record<string, string> = {
  US: 'USA', JP: 'Japan', GB: 'UK', CA: 'Canada', FR: 'France', SE: 'Sweden', CN: 'China', PL: 'Poland', KR: 'South Korea',
  FI: 'Finland', AU: 'Australia', DE: 'Germany', CZ: 'Czechia', DK: 'Denmark', NL: 'Netherlands', NZ: 'New Zealand', CY: 'Cyprus',
  ES: 'Spain', UA: 'Ukraine', IL: 'Israel', BE: 'Belgium', AT: 'Austria', IE: 'Ireland', TR: 'Türkiye', UY: 'Uruguay', RU: 'Russia',
  IT: 'Italy', CH: 'Switzerland', CL: 'Chile', EE: 'Estonia', HR: 'Croatia', HU: 'Hungary', IN: 'India', IS: 'Iceland', LV: 'Latvia',
  MX: 'Mexico', NO: 'Norway', SG: 'Singapore', TW: 'Taiwan', BR: 'Brazil', AR: 'Argentina', VN: 'Vietnam', SK: 'Slovakia',
};
export const originLabel = (code: string) => ORIGINS[code] ?? code;

export type PlayStatus = 'none' | 'want' | 'playing' | 'finished' | 'dropped';
export const PLAY_LABELS: Record<PlayStatus, string> = { none: 'No status', want: 'Want to play', playing: 'Playing', finished: 'Finished', dropped: 'Dropped' };

export type GameStatus = 'pending' | 'ok' | 'failed' | 'manual';

export interface GameLink {
  label: string;
  url: string;
}

export interface Game {
  id: string;
  title: string;
  year: number | null;
  platforms: Platform[];
  genres: Genre[];
  /** ISO country code of the lead developer, e.g. JP. */
  origin: string;
  types: GameType[];
  /** About how long the main story takes, in hours; 0 means it has no ending (online or endless games). */
  hours: number | null;
  officialUrl: string;
  ignUrl: string;
  wikiUrl: string;
  /** YouTube video id of the trailer. */
  trailerId: string;
  /** Other pages about the game. Kept here, never in the Links tab. */
  links: GameLink[];
  coverUrl: string;
  summary: string;
  developer: string;
  /** Place in the starter list (1 = best known); null for games added by hand. */
  rank: number | null;
  status: PlayStatus;
  myRating: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  fetchedAt: string | null;
  metadataStatus: GameStatus;
}

export interface GameLibrary {
  games: Game[];
}

export function blankGame(patch: Partial<Game> = {}): Game {
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    year: null,
    platforms: [],
    genres: [],
    origin: '',
    types: [],
    hours: null,
    officialUrl: '',
    ignUrl: '',
    wikiUrl: '',
    trailerId: '',
    links: [],
    coverUrl: '',
    summary: '',
    developer: '',
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
export const normGame = norm;

/** Same game, for blocking duplicates: same name, and same year when both are known. */
export function sameGame(a: Pick<Game, 'title' | 'year'>, b: Pick<Game, 'title' | 'year'>): boolean {
  if (a.year != null && b.year != null && a.year !== b.year) return false;
  return norm(a.title) === norm(b.title);
}

/** "52 h", "8.5 h", "No ending". */
export function fmtHours(h: number | null): string {
  if (h == null) return '';
  if (h === 0) return 'No ending';
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

/** Play-time buckets for the filter. */
export const HOUR_BUCKETS = {
  short: { label: 'Under 10 h', test: (h: number) => h > 0 && h < 10 },
  medium: { label: '10–30 h', test: (h: number) => h >= 10 && h <= 30 },
  long: { label: '30–60 h', test: (h: number) => h > 30 && h <= 60 },
  epic: { label: 'Over 60 h', test: (h: number) => h > 60 },
  endless: { label: 'No ending', test: (h: number) => h === 0 },
} as const;
export type HourBucket = keyof typeof HOUR_BUCKETS;

/** Turns a YouTube link (or a bare id) into a video id, or ''. */
export function youtubeId(text: string): string {
  const t = text.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  return t.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] ?? '';
}
