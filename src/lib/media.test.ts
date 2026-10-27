import { describe, expect, it } from 'vitest';
import { bestMatch, MediaStore, mergeWatch } from './media-store';
import { isMediaUrl, jwOffers, languageFromScript, languageFromText, parseMediaInput, pickTrailer, type Candidate, type MediaFetchers } from './media-sources';
import { TOP_MOVIES, TOP_TV } from './media-top';
import { blankItem } from './media-types';
import { LinkStore } from './link-store';
import { MemoryStorage } from './storage';

const jwNode = (title: string, year: number, imdbId: string, extra: Record<string, unknown> = {}) => ({
  id: `tm-${imdbId}`,
  objectType: 'MOVIE',
  content: {
    title, originalTitle: title, originalReleaseYear: year, shortDescription: `${title} plot`, posterUrl: '/poster/1/{profile}/x.{format}',
    fullPath: `/in/movie/${title.toLowerCase()}`, runtime: 148, genres: [{ shortName: 'scf' }], externalIds: { imdbId },
    scoring: { imdbScore: 8.8, imdbVotes: 2_600_000, tomatoMeter: 87 }, clips: [],
  },
  offers: [
    { monetizationType: 'FLATRATE', standardWebURL: 'https://app.primevideo.com/detail?gti=1', package: { clearName: 'Amazon Prime Video' } },
    { monetizationType: 'FLATRATE', standardWebURL: 'https://app.primevideo.com/detail?gti=1', package: { clearName: 'Amazon Prime Video' } },
    { monetizationType: 'RENT', standardWebURL: 'https://play.google.com/x', package: { clearName: 'Google Play Movies' } },
  ],
  ...extra,
});

function fakeFetchers(): MediaFetchers & { posts: string[] } {
  const posts: string[] = [];
  return {
    posts,
    async postJson(_url, body) {
      posts.push(body);
      const q = JSON.parse(body).variables.q as string;
      const edges = q === 'Inception' ? [{ node: jwNode('Inception', 2010, 'tt1375666') }, { node: jwNode('Inception: The Cobol Job', 2010, 'tt5295894') }] : [];
      return JSON.stringify({ data: { popularTitles: { edges } } });
    },
    async get(url) {
      if (url.includes('wikidata')) return JSON.stringify({ query: { search: [] } });
      if (url.includes('rest.php')) return JSON.stringify({ pages: [] });
      if (url.includes('imdb')) return JSON.stringify({ d: [] });
      throw new Error(`unexpected ${url}`);
    },
  };
}

describe('parseMediaInput', () => {
  it('reads IMDb, JustWatch, Wikipedia, YouTube and plain names', () => {
    expect(parseMediaInput('https://www.imdb.com/title/tt1375666/?ref_=x')).toMatchObject({ kind: 'imdb', imdbId: 'tt1375666' });
    expect(parseMediaInput('https://www.justwatch.com/in/movie/kantara/')).toMatchObject({ kind: 'justwatch', path: '/in/movie/kantara' });
    expect(parseMediaInput('https://en.wikipedia.org/wiki/Kantara_(2022_film)')).toMatchObject({ kind: 'wiki', title: 'Kantara (2022 film)' });
    expect(parseMediaInput('https://youtu.be/YoHD9XEInc0')).toMatchObject({ kind: 'youtube', videoId: 'YoHD9XEInc0' });
    expect(parseMediaInput('https://www.rottentomatoes.com/m/the_dark_knight')).toMatchObject({ kind: 'search', query: 'the dark knight' });
    expect(parseMediaInput('Kantara 2022')).toEqual({ kind: 'search', query: 'Kantara', year: 2022 });
    expect(parseMediaInput('ಕಾಂತಾರ')).toEqual({ kind: 'search', query: 'ಕಾಂತಾರ', year: null });
  });
  it('knows which links belong to movies and TV', () => {
    expect(isMediaUrl('https://m.imdb.com/title/tt1375666/')).toBe(true);
    expect(isMediaUrl('https://en.wikipedia.org/wiki/Inception')).toBe(false);
    expect(isMediaUrl('https://en.wikipedia.org/wiki/Kantara_(2022_film)')).toBe(true);
    expect(isMediaUrl('https://en.wikipedia.org/wiki/Panchayat_(TV_series)')).toBe(true);
    expect(isMediaUrl('https://github.com/x/y')).toBe(false);
    expect(isMediaUrl('https://www.imdb.com/?ref_=login')).toBe(false);
    expect(isMediaUrl('https://www.justwatch.com/in/new')).toBe(false);
    expect(isMediaUrl('https://www.justwatch.com/in/tv-show/panchayat')).toBe(true);
    expect(isMediaUrl('https://www.rottentomatoes.com/m/inception')).toBe(true);
    expect(isMediaUrl('https://www.themoviedb.org/movie/27205-inception')).toBe(true);
    expect(isMediaUrl('https://letterboxd.com/film/inception/')).toBe(true);
  });
});

describe('languages', () => {
  it('guesses from script and from Wikipedia text', () => {
    expect(languageFromScript('ಕಾಂತಾರ')).toBe('Kannada');
    expect(languageFromScript('千と千尋の神隠し')).toBe('Japanese');
    expect(languageFromScript('Inception')).toBe('');
    expect(languageFromText('a 2022 Indian Kannada-language mythological film')).toBe('Kannada');
  });
});

describe('JustWatch offers', () => {
  it('keeps one per platform and type', () => {
    const w = jwOffers(jwNode('X', 2000, 'tt1').offers);
    expect(w.map((o) => `${o.provider}:${o.type}`)).toEqual(['Amazon Prime Video:stream', 'Google Play Movies:rent']);
  });
  it('keeps platforms typed by hand when refreshing', () => {
    const merged = mergeWatch(
      [{ provider: 'aha', url: '', type: 'stream', manual: true }, { provider: 'Netflix', url: 'n', type: 'stream', manual: false }],
      [{ provider: 'JioHotstar', url: 'h', type: 'stream', manual: false }],
    );
    expect(merged.map((w) => w.provider)).toEqual(['aha', 'JioHotstar']);
  });
});

describe('bestMatch', () => {
  const c = (title: string, year: number, imdbId = ''): Candidate => ({ ...({} as Candidate), source: 'justwatch', kind: 'movie', title, originalTitle: '', year, imdbId, watch: [], genres: [] });
  it('prefers the IMDb id, then name and year', () => {
    expect(bestMatch([c('The Hunt', 2020), c('The Hunt', 2012)], { kind: 'movie', title: 'The Hunt', originalTitle: '', year: 2012, imdbId: '' })?.year).toBe(2012);
    expect(bestMatch([c('Joker', 2019, 'tt7286456')], { kind: 'movie', title: 'Something', originalTitle: '', year: null, imdbId: 'tt7286456' })?.title).toBe('Joker');
    expect(bestMatch([c('Joker: Folie à Deux', 2024)], { kind: 'movie', title: 'Joker', originalTitle: '', year: 2019, imdbId: '' })).toBeNull();
  });
});

describe('pickTrailer', () => {
  it('takes the first trailer in YouTube results', () => {
    const html = '"videoRenderer":{"videoId":"aaaaaaaaaaa","thumbnail":{},"title":{"runs":[{"text":"Behind the scenes"}]}},"videoRenderer":{"videoId":"YoHD9XEInc0","title":{"runs":[{"text":"Inception (2010) Official Trailer"}]}}';
    expect(pickTrailer(html)).toBe('YoHD9XEInc0');
  });
});

describe('MediaStore', () => {
  it('fills a title from JustWatch and never stores the same one twice', async () => {
    const storage = new MemoryStorage();
    const f = fakeFetchers();
    const store = new MediaStore(storage.media, f, () => 'IN');
    await store.init();
    const hits = await store.search('Inception', 'movie');
    expect(hits[0]).toMatchObject({ title: 'Inception', imdbId: 'tt1375666', imdbRating: 8.8, rtScore: 87, genres: ['Sci-Fi'] });
    const first = await store.addCandidate(hits[0]);
    for (let i = 0; i < 50 && store.fetching.size; i++) await new Promise((r) => setTimeout(r, 0));
    expect(first.existed).toBe(false);
    expect((await store.addCandidate(hits[0])).existed).toBe(true);
    const saved = store.getSnapshot().items[0];
    expect(saved.watch.map((w) => w.provider)).toEqual(['Amazon Prime Video', 'Google Play Movies']);
    expect(saved.metadataStatus).toBe('ok');
    expect((await storage.media.load()).items).toHaveLength(1);
  });

  it('adds the top 250 lists once', async () => {
    expect(TOP_MOVIES).toHaveLength(250);
    expect(TOP_TV).toHaveLength(250);
    const store = new MediaStore(new MemoryStorage().media, null, () => 'IN');
    expect(await store.addTop('movie')).toEqual({ added: 250, skipped: 0 });
    expect(await store.addTop('movie')).toEqual({ added: 0, skipped: 250 });
    expect(store.getSnapshot().items.every((i) => i.kind === 'movie' && i.metadataStatus === 'pending')).toBe(true);
  });

  it('keeps hand-added titles apart and spots duplicates by name and year', async () => {
    const store = new MediaStore(new MemoryStorage().media, null, () => 'IN');
    await store.addManual(blankItem('tv', { title: 'Panchayat', year: 2020, language: 'Hindi' }));
    expect((await store.addManual(blankItem('tv', { title: 'panchayat', year: 2020 }))).existed).toBe(true);
    expect((await store.addManual(blankItem('movie', { title: 'Panchayat', year: 2020 }))).existed).toBe(false);
  });
});

describe('duplicates and rewatches', () => {
  it('blocks edits that would duplicate another title', async () => {
    const store = new MediaStore(new MemoryStorage().media, null, () => 'IN');
    await store.addManual(blankItem('movie', { title: 'Inception', year: 2010, imdbId: 'tt1375666' }));
    const { item } = await store.addManual(blankItem('movie', { title: 'Tenet', year: 2020 }));
    await expect(store.update(item.id, { imdbId: 'tt1375666' })).rejects.toThrow(/already saved/);
    await expect(store.update(item.id, { title: 'Inception', year: 2010 })).rejects.toThrow(/already saved/);
    await store.update(item.id, { notes: 'fine' });
    // Same name in its own language counts as the same title.
    expect((await store.addManual(blankItem('movie', { title: 'Something else', originalTitle: 'Tenet', year: 2020 }))).existed).toBe(true);
  });

  it('merges two saved names that turn out to be one title', async () => {
    const storage = new MemoryStorage();
    const store = new MediaStore(storage.media, fakeFetchers(), () => 'IN');
    await store.init();
    const old = blankItem('movie', { title: 'Inception (Nolan)', imdbId: 'tt1375666', status: 'watched', watchCount: 2, createdAt: '2020-01-01T00:00:00Z' });
    const dup = blankItem('movie', { title: 'Inception', year: 2010, notes: 'from a friend', metadataStatus: 'pending' });
    await storage.media.save([old, dup]);
    await store.init();
    await store.fetchDetails([dup.id]);
    const items = store.getSnapshot().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: old.id, watchCount: 2, status: 'watched', notes: 'from a friend' });
  });

  it('counts rewatches', async () => {
    const store = new MediaStore(new MemoryStorage().media, null, () => 'IN');
    const { item } = await store.addManual(blankItem('tv', { title: 'Panchayat' }));
    await store.addWatch(item.id);
    await store.addWatch(item.id);
    expect(store.getSnapshot().items[0]).toMatchObject({ watchCount: 2, status: 'watched' });
    await store.setWatchCount(item.id, 0);
    expect(store.getSnapshot().items[0]).toMatchObject({ watchCount: 0, status: 'none' });
  });
});

describe('Links hand movie links over', () => {
  it('does not save IMDb links in Links', async () => {
    const storage = new MemoryStorage();
    const links = new LinkStore(storage.links, async (url) => ({ finalUrl: url, title: '', description: '', imageUrl: '', faviconUrl: '', siteName: '', keywords: [] }));
    await links.init();
    const sent: string[] = [];
    links.mediaSink = (urls) => sent.push(...urls);
    const r = await links.addUrls(['https://www.imdb.com/title/tt1375666/', 'https://example.com/a']);
    expect(r.media).toEqual(['https://www.imdb.com/title/tt1375666/']);
    expect(sent).toEqual(r.media);
    expect(links.getSnapshot().links.map((l) => l.domain)).toEqual(['example.com']);
  });
});
