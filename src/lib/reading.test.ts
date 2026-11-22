import { describe, expect, it } from 'vitest';
import { adaptationType, authorFits, isWorkPage, pickPlot } from './read-sources';
import { ReadStore, topReads } from './read-store';
import { blankRead, goodreadsLink, MAGAZINE_CATEGORIES, sameRead } from './read-types';
import { MemoryStorage } from './storage';

describe('starter lists', () => {
  const books = topReads('book');
  const comics = topReads('comic');
  const mags = topReads('magazine');

  it('has 1000 books (English and Tamil), 1000 comics and 150 magazines', () => {
    expect(books).toHaveLength(1000);
    expect(comics).toHaveLength(1000);
    expect(mags).toHaveLength(150);
    expect(books.filter((b) => b.language === 'Tamil').length).toBeGreaterThanOrEqual(100);
    expect(books.filter((b) => b.language === 'English').length).toBeGreaterThanOrEqual(850);
  });

  it('has no repeats and every entry has a name and an author', () => {
    for (const list of [books, comics]) {
      const keys = new Set(list.map((x) => `${x.title.toLowerCase()}|${x.authors.toLowerCase()}`));
      expect(keys.size).toBe(list.length);
      for (const x of list) {
        expect(x.title, JSON.stringify(x)).toBeTruthy();
        expect(x.authors, x.title).toBeTruthy();
        expect(x.metadataStatus).toBe('pending');
      }
    }
    expect(new Set(mags.map((m) => m.title)).size).toBe(150);
  });

  it('puts 70% of magazines in the seven asked-for categories', () => {
    const asked = MAGAZINE_CATEGORIES.slice(0, 7) as readonly string[];
    expect(mags.filter((m) => asked.includes(m.category))).toHaveLength(105);
    for (const c of asked) expect(mags.filter((m) => m.category === c).length, c).toBe(15);
    for (const m of mags) expect((MAGAZINE_CATEGORIES as readonly string[]).includes(m.category), m.title).toBe(true);
  });

  it('keeps Tamil titles for Tamil books', () => {
    const ps = books.find((b) => b.title === 'Ponniyin Selvan')!;
    expect(ps).toMatchObject({ language: 'Tamil', authors: 'Kalki Krishnamurthy', originalTitle: 'பொன்னியின் செல்வன்' });
  });
});

describe('reading Wikipedia and Wikidata', () => {
  it('tells work pages from others', () => {
    expect(isWorkPage({ title: 'Dune (novel)', description: '1965 novel by Frank Herbert' }, 'book')).toBe(true);
    expect(isWorkPage({ title: 'Dune', description: 'Hill of loose sand built by wind' }, 'book')).toBe(false);
    expect(isWorkPage({ title: 'The Godfather', description: '1972 film by Francis Ford Coppola' }, 'book')).toBe(false);
    expect(isWorkPage({ title: 'Saga (comics)', description: '' }, 'comic')).toBe(true);
    expect(isWorkPage({ title: 'Watchmen', description: 'DC Comics limited series' }, 'comic')).toBe(true);
    expect(isWorkPage({ title: 'Empire (film magazine)', description: 'British film magazine' }, 'magazine')).toBe(true);
    expect(isWorkPage({ title: 'Wired', description: 'American technology magazine' }, 'magazine')).toBe(true);
  });

  it('checks the author named in a description', () => {
    expect(authorFits('1965 novel by Frank Herbert', 'Frank Herbert')).toBe(true);
    expect(authorFits('2001 novel by Ian McEwan', 'Frank Herbert')).toBe(false);
    expect(authorFits('Novel by Gabriel García Márquez', 'Gabriel García Márquez')).toBe(true);
    expect(authorFits('Book', 'Anyone')).toBe(true);
  });

  it('sorts adaptations into movies, TV shows and documentaries', () => {
    expect(adaptationType(['feature film'])).toBe('movie');
    expect(adaptationType(['television series'])).toBe('tv');
    expect(adaptationType(['miniseries'])).toBe('tv');
    expect(adaptationType(['documentary film'])).toBe('documentary');
    expect(adaptationType(['radio drama'])).toBeNull();
  });

  it('finds the plot section', () => {
    const text = 'Intro line.\n\n== Background ==\nWritten in 1965.\n\n== Plot ==\nPaul goes to Arrakis.\n\nHe becomes Muad\'Dib.\n\n== Reception ==\nLiked.';
    expect(pickPlot(text)).toBe('Paul goes to Arrakis.\n\nHe becomes Muad\'Dib.');
    expect(pickPlot('== Synopsis ==\n\n=== Part one ===\nA boy.\n== Themes ==\nX')).toBe('A boy.');
    expect(pickPlot('== Reception ==\nLiked.')).toBe('');
  });

  it('links Goodreads, or searches it', () => {
    expect(goodreadsLink({ title: 'Dune', authors: 'Frank Herbert', goodreadsUrl: 'https://www.goodreads.com/work/editions/3634639' })).toEqual({ url: 'https://www.goodreads.com/work/editions/3634639', found: true });
    expect(goodreadsLink({ title: 'Dune', authors: 'Frank Herbert', goodreadsUrl: '' })).toEqual({ url: 'https://www.goodreads.com/search?q=Dune%20Frank%20Herbert', found: false });
  });
});

/** Fake Wikipedia, Wikidata and query service answering for Dune and Ponniyin Selvan. */
function fakeFetch(calls: string[]) {
  return {
    get: async (url: string) => {
      calls.push(url);
      const u = new URL(url);
      if (u.hostname === 'en.wikipedia.org' && u.searchParams.get('action') === 'query') {
        const titles = (u.searchParams.get('titles') ?? '').split('|');
        const pages = titles.flatMap((t): Record<string, unknown>[] => {
          if (u.searchParams.get('explaintext') && !u.searchParams.get('exintro')) return [{ title: t, extract: 'Intro.\n== Plot ==\nPaul goes to Arrakis.\n== Themes ==\nX' }];
          if (t === 'Dune (novel)') return [{ title: t, description: '1965 novel by Frank Herbert', extract: 'Dune is a novel.', thumbnail: { source: 'https://img/dune.jpg' }, pageprops: { wikibase_item: 'Q190192' } }];
          if (t === 'Ponniyin Selvan (novel)') return [{ title: t, description: 'Novel by Kalki Krishnamurthy', extract: 'A Tamil novel.', pageprops: { wikibase_item: 'Q3429999' } }];
          return [{ title: t, missing: true }];
        });
        return JSON.stringify({ query: { pages } });
      }
      if (u.hostname === 'www.wikidata.org' && u.searchParams.get('props') === 'claims|labels|sitelinks') {
        const ent = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
        const s = (v: string) => ({ mainsnak: { datavalue: { value: v } } });
        return JSON.stringify({
          entities: {
            Q190192: { labels: { en: { value: 'Dune' } }, sitelinks: { enwiki: { title: 'Dune (novel)' } }, claims: { P50: [ent('Q7934')], P136: [ent('Q24925')], P407: [ent('Q1860')], P577: [{ mainsnak: { datavalue: { value: { time: '+1965-08-01T00:00:00Z' } } } }], P8383: [s('3634639')] } },
            Q3429999: { labels: { ta: { value: 'பொன்னியின் செல்வன்' } }, sitelinks: {}, claims: { P50: [ent('Q1')], P407: [ent('Q5885')] } },
          },
        });
      }
      if (u.hostname === 'www.wikidata.org') {
        return JSON.stringify({ entities: { Q7934: { labels: { en: { value: 'Frank Herbert' } } }, Q24925: { labels: { en: { value: 'science fiction' } } }, Q1860: { labels: { en: { value: 'English' } } }, Q5885: { labels: { en: { value: 'Tamil' } } } } });
      }
      if (u.hostname === 'query.wikidata.org') {
        const row = (book: string, ad: string, label: string, type: string, date: string) => ({
          book: { value: `http://www.wikidata.org/entity/${book}` }, ad: { value: `http://www.wikidata.org/entity/${ad}` }, adLabel: { value: label }, typeLabel: { value: type }, date: { value: date },
        });
        return JSON.stringify({ results: { bindings: [
          row('Q190192', 'Q114819', 'Dune', 'film', '1984-12-14'),
          row('Q190192', 'Q1', 'Frank Herbert\'s Dune', 'miniseries', '2000-12-03'),
          row('Q3429999', 'Q2', 'Ponniyin Selvan: I', 'film', '2022-09-30'),
        ] } });
      }
      if (u.pathname.includes('/rest.php/')) return JSON.stringify({ pages: [] });
      return JSON.stringify({ query: { pages: [] } });
    },
  };
}

describe('ReadStore', () => {
  const noSleep = async () => {};

  it('adds a starter list once and fills author, Goodreads, cover and adaptations', async () => {
    const calls: string[] = [];
    const store = new ReadStore(new MemoryStorage().reading, fakeFetch(calls), noSleep);
    await store.init();
    await store.addManual(blankRead('book', { title: 'Dune', authors: 'Frank Herbert', metadataStatus: 'pending' }));
    const r = await store.addTop('book');
    expect(r).toEqual({ added: 999, skipped: 1 });
    expect(store.getSnapshot().items.find((x) => x.title === 'Dune')!.rank).toBe(34);
    const again = await store.addTop('book');
    expect(again.added).toBe(0);

    const dune = store.getSnapshot().items.find((x) => x.title === 'Dune')!;
    await store.fetchDetails([dune.id, store.getSnapshot().items.find((x) => x.title === 'Ponniyin Selvan')!.id]);
    const d = store.getSnapshot().items.find((x) => x.id === dune.id)!;
    expect(d).toMatchObject({
      metadataStatus: 'ok', qid: 'Q190192', year: 1965, coverUrl: 'https://img/dune.jpg', summary: 'Dune is a novel.', genres: ['Science fiction'],
      goodreadsUrl: 'https://www.goodreads.com/work/editions/3634639', wikiUrl: 'https://en.wikipedia.org/wiki/Dune_(novel)',
    });
    expect(d.adaptations.map((a) => [a.title, a.type, a.year])).toEqual([['Dune', 'movie', 1984], ['Frank Herbert\'s Dune', 'tv', 2000]]);
    // The rest of the list is looked up in the background.
    for (let i = 0; i < 400 && store.progress; i++) await new Promise((r) => setTimeout(r, 10));
    expect(store.progress).toBeNull();
    const ps = store.getSnapshot().items.find((x) => x.title === 'Ponniyin Selvan')!;
    expect(ps.metadataStatus).toBe('ok');
    expect(ps.originalTitle).toBe('பொன்னியின் செல்வன்');
    expect(ps.adaptations[0]).toMatchObject({ title: 'Ponniyin Selvan: I', type: 'movie', year: 2022 });

    // The plot is read on first open.
    expect(await store.fetchSynopsis(dune.id)).toBe('Paul goes to Arrakis.');
    expect(store.getSnapshot().items.find((x) => x.id === dune.id)!.synopsis).toBe('Paul goes to Arrakis.');
  });

  it('keeps a status set while the lookup runs, and marks works it can’t find', async () => {
    const store = new ReadStore(new MemoryStorage().reading, fakeFetch([]), noSleep);
    await store.init();
    const { item } = await store.addManual(blankRead('comic', { title: 'No Such Comic', authors: 'Nobody', metadataStatus: 'pending' }));
    await store.fetchDetails([item.id]);
    expect(store.getSnapshot().items[0].metadataStatus).toBe('failed');
  });

  it('exports and imports without duplicates', async () => {
    const a = new ReadStore(new MemoryStorage().reading, null);
    await a.init();
    await a.addManual(blankRead('magazine', { title: 'Wired', category: 'Technology' }));
    await a.addManual(blankRead('book', { title: 'Emma', authors: 'Jane Austen', status: 'read' }));
    const b = new ReadStore(new MemoryStorage().reading, null);
    await b.init();
    expect(await b.importJson(a.exportJson())).toEqual({ added: 2, skipped: 0 });
    expect(await b.importJson(a.exportJson())).toEqual({ added: 0, skipped: 2 });
    expect(b.getSnapshot().items.find((x) => x.title === 'Emma')!.status).toBe('read');
  });

  it('treats the same work as one', () => {
    expect(sameRead(blankRead('book', { title: 'The Hobbit', authors: 'J. R. R. Tolkien' }), blankRead('book', { title: 'Hobbit', authors: 'J. R. R. Tolkien, someone' }))).toBe(true);
    expect(sameRead(blankRead('book', { title: 'Emma', authors: 'Jane Austen' }), blankRead('comic', { title: 'Emma', authors: 'Jane Austen' }))).toBe(false);
  });
});
