import type { Bookmark, BookmarkType, Library } from './types';

export type SortKey = 'added-desc' | 'added-asc' | 'title' | 'channel' | 'published' | 'duration' | 'views';
export type WatchFilter = 'all' | 'watched' | 'unwatched';

export interface ViewState {
  type: BookmarkType | 'all';
  view: 'library' | 'history';
  /** Special value '' = Uncategorized. */
  categoryIds: string[];
  tagIds: string[];
  tagMode: 'any' | 'all';
  watch: WatchFilter;
  failedOnly: boolean;
  query: string;
  sort: SortKey;
}

export const DEFAULT_VIEW: ViewState = {
  type: 'all',
  view: 'library',
  categoryIds: [],
  tagIds: [],
  tagMode: 'any',
  watch: 'all',
  failedOnly: false,
  query: '',
  sort: 'added-desc',
};

export const SORT_LABELS: Record<SortKey, string> = {
  'added-desc': 'Date added, newest',
  'added-asc': 'Date added, oldest',
  title: 'Title A–Z',
  channel: 'Channel A–Z',
  published: 'Upload date, newest',
  duration: 'Duration, longest',
  views: 'Views, most',
};

/** Case- and accent-insensitive text used for search. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function displayTitle(b: Bookmark): string {
  return b.title || (b.type === 'channel' ? b.youtubeId : b.url.replace(/^https:\/\/(www\.)?/, ''));
}

/** Filters everything except the type, so type counts reflect the other filters. */
export function filterBase(lib: Library, v: ViewState): Bookmark[] {
  const cats = new Map(lib.categories.map((c) => [c.id, c.name]));
  const tags = new Map(lib.tags.map((t) => [t.id, t.name]));
  const q = fold(v.query.trim());
  const terms = q ? q.split(/\s+/) : [];
  return lib.bookmarks.filter((b) => {
    if (v.categoryIds.length && !v.categoryIds.includes(b.categoryId ?? '')) return false;
    if (v.tagIds.length) {
      const has = (t: string) => b.tagIds.includes(t);
      if (v.tagMode === 'all' ? !v.tagIds.every(has) : !v.tagIds.some(has)) return false;
    }
    if (v.watch === 'watched' && !b.watched) return false;
    if (v.watch === 'unwatched' && b.watched) return false;
    if (v.failedOnly && b.metadataStatus !== 'failed') return false;
    if (terms.length) {
      const hay = fold([
        displayTitle(b), b.description, b.channelName, b.notes, b.url,
        b.categoryId ? cats.get(b.categoryId) ?? '' : '',
        ...b.tagIds.map((t) => tags.get(t) ?? ''),
      ].join(' '));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

const byStr = (f: (b: Bookmark) => string) => (a: Bookmark, b: Bookmark) => f(a).localeCompare(f(b), undefined, { sensitivity: 'base' });
const byNum = (f: (b: Bookmark) => number | null) => (a: Bookmark, b: Bookmark) => (f(b) ?? -1) - (f(a) ?? -1);

const SORTERS: Record<SortKey, (a: Bookmark, b: Bookmark) => number> = {
  'added-desc': (a, b) => b.createdAt.localeCompare(a.createdAt),
  'added-asc': (a, b) => a.createdAt.localeCompare(b.createdAt),
  title: byStr(displayTitle),
  channel: byStr((b) => b.channelName.replace(/^@/, '') || '￿'),
  published: (a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  duration: byNum((b) => b.durationSec),
  views: byNum((b) => b.viewCount),
};

export function applyView(lib: Library, v: ViewState): { base: Bookmark[]; items: Bookmark[] } {
  const base = filterBase(lib, v);
  const items = base.filter((b) => v.type === 'all' || b.type === v.type);
  items.sort(v.view === 'history' ? SORTERS['added-desc'] : SORTERS[v.sort]);
  return { base, items };
}

const DAY = 86_400_000;
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatDate(iso: string, withYear = true): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

/** "Today", "Yesterday", "3 days ago", then a short date. */
export function relativeDay(iso: string, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso, new Date(iso).getFullYear() !== now.getFullYear());
}

/** Groups (already newest-first) bookmarks by the local day they were added. */
export function groupByDay(items: Bookmark[], now = new Date()): { label: string; items: Bookmark[] }[] {
  const groups: { key: number; label: string; items: Bookmark[] }[] = [];
  for (const b of items) {
    const key = startOfDay(new Date(b.createdAt));
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const days = Math.round((startOfDay(now) - key) / DAY);
      const label = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : new Date(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(b);
  }
  return groups;
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** The small label in the thumbnail's corner. */
export function metaLabel(b: Bookmark): string {
  if (b.type === 'playlist') return b.itemCount != null ? `${b.itemCount} videos` : 'Playlist';
  if (b.type === 'channel') return b.itemCount != null ? `${compactNumber(b.itemCount)} videos` : 'Channel';
  return formatDuration(b.durationSec);
}
