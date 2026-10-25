import { describe, expect, it } from 'vitest';
import type { Bookmark, Library } from './types';
import { applyView, DEFAULT_VIEW, groupByDay, relativeDay } from './view';

function bm(over: Partial<Bookmark>): Bookmark {
  return {
    id: over.id ?? Math.random().toString(36), url: 'https://www.youtube.com/watch?v=x', type: 'video', youtubeId: 'x', dedupeKey: `video:${over.id}`,
    title: '', description: '', thumbnailUrl: '', channelName: '', categoryId: null, tagIds: [], durationSec: null, publishedAt: null,
    viewCount: null, itemCount: null, notes: '', watched: false, createdAt: '2026-10-01T10:00:00Z', updatedAt: '', metadataStatus: 'ok', ...over,
  };
}

const lib: Library = {
  categories: [{ id: 'c1', name: 'Café', color: '#000', createdAt: '' }],
  tags: [{ id: 't1', name: 'rust', createdAt: '' }, { id: 't2', name: 'course', createdAt: '' }],
  bookmarks: [
    bm({ id: 'a', title: 'Intro to Rust', type: 'playlist', tagIds: ['t1', 't2'], createdAt: '2026-10-03T10:00:00Z' }),
    bm({ id: 'b', title: 'Pour-over coffee', categoryId: 'c1', watched: true, createdAt: '2026-10-02T10:00:00Z', durationSec: 700 }),
    bm({ id: 'c', title: 'Git rebase', type: 'short', tagIds: ['t1'], createdAt: '2026-10-01T10:00:00Z', durationSec: 50 }),
  ],
};

describe('applyView', () => {
  it('searches across title and category, ignoring accents and case', () => {
    expect(applyView(lib, { ...DEFAULT_VIEW, query: 'CAFE' }).items.map((b) => b.id)).toEqual(['b']);
    expect(applyView(lib, { ...DEFAULT_VIEW, query: 'rust course' }).items.map((b) => b.id)).toEqual(['a']);
  });
  it('filters by type but counts the rest', () => {
    const r = applyView(lib, { ...DEFAULT_VIEW, type: 'short' });
    expect(r.items.map((b) => b.id)).toEqual(['c']);
    expect(r.base).toHaveLength(3);
  });
  it('filters tags with any/all and watched status', () => {
    expect(applyView(lib, { ...DEFAULT_VIEW, tagIds: ['t1', 't2'], tagMode: 'all' }).items.map((b) => b.id)).toEqual(['a']);
    expect(applyView(lib, { ...DEFAULT_VIEW, tagIds: ['t1', 't2'] }).items).toHaveLength(2);
    expect(applyView(lib, { ...DEFAULT_VIEW, watch: 'unwatched' }).items.map((b) => b.id)).toEqual(['a', 'c']);
    expect(applyView(lib, { ...DEFAULT_VIEW, categoryIds: [''] }).items.map((b) => b.id)).toEqual(['a', 'c']);
  });
  it('sorts', () => {
    expect(applyView(lib, { ...DEFAULT_VIEW, sort: 'added-asc' }).items.map((b) => b.id)).toEqual(['c', 'b', 'a']);
    expect(applyView(lib, { ...DEFAULT_VIEW, sort: 'title' }).items.map((b) => b.id)).toEqual(['c', 'a', 'b']);
    expect(applyView(lib, { ...DEFAULT_VIEW, sort: 'duration' }).items.map((b) => b.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('history helpers', () => {
  const now = new Date(2026, 9, 25, 12);
  it('labels days relative to now', () => {
    expect(relativeDay(new Date(2026, 9, 25, 1).toISOString(), now)).toBe('Today');
    expect(relativeDay(new Date(2026, 9, 24, 23).toISOString(), now)).toBe('Yesterday');
    expect(relativeDay(new Date(2026, 9, 21).toISOString(), now)).toBe('4 days ago');
  });
  it('groups by local day', () => {
    const items = [new Date(2026, 9, 25, 9), new Date(2026, 9, 25, 8), new Date(2026, 9, 24, 8), new Date(2026, 9, 1)].map((d, i) =>
      bm({ id: String(i), createdAt: d.toISOString() }));
    const groups = groupByDay(items, now);
    expect(groups.map((g) => [g.label.split(',')[0], g.items.length])).toEqual([['Today', 2], ['Yesterday', 1], [expect.any(String), 1]]);
  });
});
