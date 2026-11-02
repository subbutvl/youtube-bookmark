import { describe, expect, it } from 'vitest';
import { exportCsv, exportJson, parseCsv, parseImportFile, parseJsonBackup, parseLinks } from './backup';
import { LibraryStore } from './library';
import { MemoryStorage } from './storage';
import { YouTubeApi, type FetchedMetadata } from './youtube-api';

class FakeApi extends YouTubeApi {
  calls = 0;
  constructor(private readonly known: Record<string, Partial<FetchedMetadata>>) {
    super('KEY');
  }
  override async fetchMany(reqs: { type: string; youtubeId: string }[]) {
    this.calls++;
    const out = new Map<string, FetchedMetadata>();
    for (const r of reqs) {
      const k = `${r.type}:${r.youtubeId}`;
      if (this.known[k]) {
        out.set(k, { title: '', description: '', thumbnailUrl: '', channelName: '', channelUrl: '', categoryName: null, tags: [], durationSec: null, publishedAt: null, viewCount: null, itemCount: null, ...this.known[k] });
      }
    }
    return out;
  }
}

async function makeStore(known: Record<string, Partial<FetchedMetadata>> = {}, key = 'KEY') {
  const storage = new MemoryStorage();
  const api = new FakeApi(known);
  const store = new LibraryStore(storage, () => api, key);
  await store.init();
  return { store, storage, api };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('LibraryStore.addUrls', () => {
  it('never stores the same link twice', async () => {
    const { store, storage } = await makeStore();
    const first = await store.addUrls('https://youtu.be/QcCTQ0pyjME?si=abc');
    expect(first.added).toHaveLength(1);

    const second = await store.addUrls([
      'https://www.youtube.com/watch?v=QcCTQ0pyjME',
      'https://www.youtube.com/watch?v=QcCTQ0pyjME&t=2s',
      'https://www.youtube.com/@Chan/videos',
      'https://www.youtube.com/@chan',
      'not a link',
    ].join('\n'));
    expect(second.added.map((b) => b.type)).toEqual(['channel']);
    expect(second.duplicates).toHaveLength(3);
    expect(second.duplicates[0].existing.id).toBe(first.added[0].id);
    expect(second.invalid).toEqual(['not', 'a', 'link']);
    expect((await storage.load()).bookmarks).toHaveLength(2);
  });

  it('records when the link was added and starts unwatched', async () => {
    const { store } = await makeStore();
    const before = Date.now();
    const { added } = await store.addUrls('https://www.youtube.com/shorts/abcdefghijk');
    expect(Date.parse(added[0].createdAt)).toBeGreaterThanOrEqual(before);
    expect(added[0].watched).toBe(false);
    expect(added[0].thumbnailUrl).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  });

  it('offers the playlist from a watch URL', async () => {
    const { store } = await makeStore();
    const r = await store.addUrls('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz');
    expect(r.playlistOffers).toEqual(['PLxyz']);
  });

  it('fills metadata, creating the YouTube category and tags', async () => {
    const { store } = await makeStore({
      'video:dQw4w9WgXcQ': { title: 'Never Gonna', description: 'Line', categoryName: 'Music', tags: ['pop', 'eighties'], durationSec: 213 },
    });
    await store.addUrls('https://youtu.be/dQw4w9WgXcQ\nhttps://youtu.be/zzzzzzzzzzz');
    await flush();
    const lib = store.getSnapshot();
    const ok = lib.bookmarks.find((b) => b.youtubeId === 'dQw4w9WgXcQ')!;
    expect(ok).toMatchObject({ title: 'Never Gonna', metadataStatus: 'ok', durationSec: 213 });
    expect(lib.categories.find((c) => c.id === ok.categoryId)?.name).toBe('Music');
    expect(ok.tagIds.map((id) => lib.tags.find((t) => t.id === id)?.name)).toEqual(['pop', 'eighties']);
    expect(lib.bookmarks.find((b) => b.youtubeId === 'zzzzzzzzzzz')?.metadataStatus).toBe('failed');
  });

  it('marks bookmarks partial when there is no API key', async () => {
    const { store, api } = await makeStore({}, '');
    await store.addUrls('https://youtu.be/dQw4w9WgXcQ');
    await flush();
    expect(api.calls).toBe(0);
    expect(store.getSnapshot().bookmarks[0].metadataStatus).toBe('partial');
  });
});

describe('watched, categories and tags', () => {
  it('toggles watched manually', async () => {
    const { store } = await makeStore({}, '');
    const { added } = await store.addUrls('https://youtu.be/dQw4w9WgXcQ');
    await store.setWatched([added[0].id], true);
    expect(store.getSnapshot().bookmarks[0].watched).toBe(true);
  });

  it('deleting a category leaves bookmarks uncategorized; merging moves them', async () => {
    const { store } = await makeStore({}, '');
    const a = await store.addCategory('Music');
    const b = await store.addCategory('Songs');
    const { added } = await store.addUrls('https://youtu.be/dQw4w9WgXcQ\nhttps://youtu.be/aaaaaaaaaaa', { categoryId: b.id });
    await store.mergeCategory(b.id, a.id);
    expect(store.getSnapshot().bookmarks.every((x) => x.categoryId === a.id)).toBe(true);
    await store.deleteCategory(a.id);
    expect(store.getSnapshot().bookmarks.find((x) => x.id === added[0].id)?.categoryId).toBeNull();
    await expect(store.addCategory('music')).resolves.toMatchObject({ name: 'music' });
    await expect(store.addCategory('MUSIC')).resolves.toMatchObject({ name: 'music' }); // reused, not duplicated
  });

  it('renaming a tag onto an existing name merges them', async () => {
    const { store } = await makeStore({}, '');
    await store.addUrls('https://youtu.be/dQw4w9WgXcQ', { tagNames: ['js', 'javascript'] });
    const [js, javascript] = store.getSnapshot().tags;
    await store.renameTag(js.id, 'JavaScript');
    const lib = store.getSnapshot();
    expect(lib.tags.map((t) => t.name)).toEqual(['javascript']);
    expect(lib.bookmarks[0].tagIds).toEqual([javascript.id]);
  });
});

describe('import and export', () => {
  it('round-trips through JSON and skips duplicates on merge', async () => {
    const { store } = await makeStore({}, '');
    const cat = await store.addCategory('Tutorials');
    await store.addUrls('https://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@chan', { categoryId: cat.id, tagNames: ['code'] });
    await store.setWatched([store.getSnapshot().bookmarks[0].id], true);
    const json = exportJson(store.getSnapshot());

    const { store: other } = await makeStore({}, '');
    await other.addUrls('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const parsed = parseJsonBackup(json);
    expect(other.previewImport(parsed.items, 'merge')).toEqual({ added: 1, duplicates: 1 });
    const res = await other.importItems(parsed.items, 'merge');
    expect(res).toEqual({ added: 1, duplicates: 1 });
    const lib = other.getSnapshot();
    expect(lib.bookmarks).toHaveLength(2);
    expect(lib.categories.map((c) => c.name)).toEqual(['Tutorials']);
    expect(lib.bookmarks.every((b) => b.tagIds.length === 1)).toBe(true);
  });

  it('reads the migrated file format from the old app', async () => {
    const file = JSON.stringify({
      version: 1,
      categories: [],
      tags: [],
      bookmarks: [
        { id: 'x', url: 'https://www.youtube.com/watch?v=_0xa6RVqTC8', type: 'video', youtubeId: '_0xa6RVqTC8', createdAt: '2026-01-30T12:43:49.808000Z', watched: true, metadataStatus: 'pending' },
        { id: 'y', url: 'https://www.youtube.com/@malvaAI', type: 'channel', youtubeId: '@malvaAI', createdAt: '2026-01-30T12:43:49.888000Z', watched: false },
      ],
    });
    const { store } = await makeStore({}, '');
    const parsed = parseImportFile('youtube-organizer-migrated.ytbm.json', file);
    await store.importItems(parsed.items, 'merge');
    const [a, b] = store.getSnapshot().bookmarks;
    expect(a).toMatchObject({ type: 'video', watched: true, createdAt: '2026-01-30T12:43:49.808Z', metadataStatus: 'pending' });
    expect(b).toMatchObject({ type: 'channel', youtubeId: '@malvaAI' });
    expect(store.needsMetadata).toHaveLength(2);
  });

  it('round-trips CSV, including quotes and commas', async () => {
    const { store } = await makeStore({}, '');
    const { added } = await store.addUrls('https://youtu.be/dQw4w9WgXcQ', { tagNames: ['a', 'b'] });
    await store.updateBookmark(added[0].id, { title: 'Hello, "world"', notes: 'line1\nline2' });
    const parsed = parseCsv(exportCsv(store.getSnapshot()));
    expect(parsed.items[0]).toMatchObject({ title: 'Hello, "world"', notes: 'line1\nline2', tagNames: ['a', 'b'] });
  });

  it('finds links in plain text and bookmark HTML', () => {
    const r = parseLinks('<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=5">x</a> https://youtu.be/dQw4w9WgXcQ https://example.com');
    expect(r).toMatchObject({ invalid: 1, repeated: 1 });
    expect(r.items).toHaveLength(1);
  });
});

describe('old app import', () => {
  it('keeps link, type, watched and date; merges duplicate rows', async () => {
    const { parseLegacyItems } = await import('./backup');
    const parsed = parseLegacyItems([
      { url: 'https://www.youtube.com/watch?v=QcCTQ0pyjME', type: 'video', watched: false, dateAdded: 1769777029808 },
      { url: 'https://youtu.be/QcCTQ0pyjME?si=W088', type: 'video', watched: true, dateAdded: 1769777030000 },
      { url: 'https://www.youtube.com/@appliedwithai/videos', type: 'channel', watched: false, dateAdded: 1769777031000 },
    ]);
    expect(parsed.repeated).toBe(1);
    expect(parsed.items).toEqual([
      expect.objectContaining({ type: 'video', youtubeId: 'QcCTQ0pyjME', watched: true, createdAt: '2026-01-30T12:43:49.808Z' }),
      expect.objectContaining({ type: 'channel', url: 'https://www.youtube.com/@appliedwithai' }),
    ]);
    const { store } = await makeStore({}, '');
    await store.importItems(parsed.items, 'merge');
    expect(store.getSnapshot().bookmarks.find((b) => b.type === 'channel')?.channelUrl).toBe('https://www.youtube.com/@appliedwithai');
  });
});
