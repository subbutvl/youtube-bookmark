import { isNew, type Link, type LinkFlag, type LinkLibrary } from './link-types';
import { fold } from './view';

export type LinkSortKey = 'added-desc' | 'added-asc' | 'title' | 'domain' | 'opened-most' | 'opened-last';
export type LinkStatus = 'all' | 'new' | 'viewed';
export type AddedWithin = 'all' | 'today' | 'week';

export interface LinkViewState {
  query: string;
  /** '' stands for Uncategorized. */
  categoryIds: string[];
  tagIds: string[];
  tagMode: 'any' | 'all';
  status: LinkStatus;
  /** Links must carry every flag listed. */
  flags: LinkFlag[];
  domain: string | null;
  /** One of the user's own groups. */
  group: string | null;
  added: AddedWithin;
  sort: LinkSortKey;
}

export const DEFAULT_LINK_VIEW: LinkViewState = {
  query: '',
  categoryIds: [],
  tagIds: [],
  tagMode: 'any',
  status: 'all',
  flags: [],
  domain: null,
  group: null,
  added: 'all',
  sort: 'added-desc',
};

export const LINK_SORT_LABELS: Record<LinkSortKey, string> = {
  'added-desc': 'Newest added',
  'added-asc': 'Oldest added',
  title: 'Title A–Z',
  domain: 'Site A–Z',
  'opened-most': 'Most opened',
  'opened-last': 'Last opened',
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function linkTitle(l: Link): string {
  return l.title || l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function addedSince(added: AddedWithin, now: Date): number {
  if (added === 'today') return startOfDay(now);
  if (added === 'week') return startOfDay(now) - 6 * DAY;
  return -Infinity;
}

export function applyLinkView(lib: LinkLibrary, v: LinkViewState, now = new Date()): Link[] {
  const tagName = new Map(lib.tags.map((t) => [t.id, t.name]));
  const catName = new Map(lib.categories.map((c) => [c.id, c.name]));
  const words = fold(v.query).split(/\s+/).filter(Boolean);
  const since = addedSince(v.added, now);
  const items = lib.links.filter((l) => {
    if (v.categoryIds.length && !v.categoryIds.includes(l.categoryId ?? '')) return false;
    if (v.tagIds.length) {
      const hit = v.tagMode === 'all' ? v.tagIds.every((t) => l.tagIds.includes(t)) : v.tagIds.some((t) => l.tagIds.includes(t));
      if (!hit) return false;
    }
    if (v.status === 'new' && !isNew(l)) return false;
    if (v.status === 'viewed' && !l.viewed) return false;
    if (v.flags.some((f) => !l.flags.includes(f))) return false;
    if (v.domain && l.domain !== v.domain) return false;
    if (v.group && l.groupName !== v.group) return false;
    if (since > -Infinity && Date.parse(l.createdAt) < since) return false;
    if (words.length) {
      const hay = fold([l.title, l.url, l.groupName ?? '', l.description, l.siteName, l.notes, catName.get(l.categoryId ?? '') ?? '', ...l.tagIds.map((t) => tagName.get(t) ?? '')].join(' '));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const byTitle = (a: Link, b: Link) => linkTitle(a).localeCompare(linkTitle(b), undefined, { sensitivity: 'base' });
  const cmp: Record<LinkSortKey, (a: Link, b: Link) => number> = {
    'added-desc': (a, b) => b.createdAt.localeCompare(a.createdAt),
    'added-asc': (a, b) => a.createdAt.localeCompare(b.createdAt),
    title: byTitle,
    domain: (a, b) => a.domain.localeCompare(b.domain) || byTitle(a, b),
    'opened-most': (a, b) => b.openCount - a.openCount || (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''),
    'opened-last': (a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '') || b.createdAt.localeCompare(a.createdAt),
  };
  return items.sort(cmp[v.sort]);
}

export interface LinkKpis {
  total: number;
  today: number;
  week: number;
  fresh: number;
  later: number;
  must: number;
  viewedPct: number;
}

export function linkKpis(links: Link[], now = new Date()): LinkKpis {
  const today = addedSince('today', now);
  const week = addedSince('week', now);
  let t = 0, w = 0, n = 0, later = 0, must = 0, viewed = 0;
  for (const l of links) {
    const at = Date.parse(l.createdAt);
    if (at >= today) t++;
    if (at >= week) w++;
    if (isNew(l)) n++;
    if (l.flags.includes('later')) later++;
    if (l.flags.includes('must')) must++;
    if (l.viewed) viewed++;
  }
  return { total: links.length, today: t, week: w, fresh: n, later, must, viewedPct: links.length ? Math.round((viewed / links.length) * 100) : 0 };
}

export type LinkRow =
  | { kind: 'link'; link: Link }
  /** `manual` groups are the user's own; the others are links from one site. */
  | { kind: 'group'; key: string; label: string; manual: boolean; links: Link[] };

/**
 * Folds links into groups, each placed where its first link falls in the current sort:
 * the user's own groups always, and (with `bySite`) other links from the same site.
 * A site with a single link stays a plain row.
 */
export function groupRows(items: Link[], bySite: boolean): LinkRow[] {
  const keyOf = (l: Link) => (l.groupName ? `g:${l.groupName}` : bySite ? `d:${l.domain}` : null);
  const groups = new Map<string, Link[]>();
  for (const l of items) {
    const key = keyOf(l);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(l);
    else groups.set(key, [l]);
  }
  const rows: LinkRow[] = [];
  const placed = new Set<string>();
  for (const l of items) {
    const key = keyOf(l);
    if (!key) {
      rows.push({ kind: 'link', link: l });
      continue;
    }
    if (placed.has(key)) continue;
    placed.add(key);
    const list = groups.get(key)!;
    const manual = !!l.groupName;
    if (!manual && list.length === 1) rows.push({ kind: 'link', link: l });
    else rows.push({ kind: 'group', key, label: manual ? l.groupName! : l.domain, manual, links: list });
  }
  return rows;
}
