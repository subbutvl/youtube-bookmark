import { describe, expect, it } from 'vitest';
import { gameLinks, genresFrom, isGamePage, originFrom, platformsFrom, typesFrom } from './game-sources';
import { GameStore, topGames } from './game-store';
import { blankGame, fmtHours, GAME_TYPES, GENRES, ORIGINS, PLATFORMS, youtubeId } from './game-types';
import { MemoryStorage } from './storage';

describe('top 500 list', () => {
  const list = topGames();

  it('has 500 different games, each with platforms, genres, origin, type and play time', () => {
    expect(list).toHaveLength(500);
    expect(new Set(list.map((g) => g.title.toLowerCase())).size).toBe(500);
    for (const g of list) {
      expect(g.platforms.length, g.title).toBeGreaterThan(0);
      expect(g.genres.length, g.title).toBeGreaterThan(0);
      expect(g.types.length, g.title).toBeGreaterThan(0);
      expect(ORIGINS[g.origin], `${g.title}: ${g.origin}`).toBeTruthy();
      expect(g.hours, g.title).not.toBeNull();
      expect(g.year! > 1980 && g.year! <= 2026, g.title).toBe(true);
    }
    expect(list[0]).toMatchObject({ rank: 1, title: 'The Witcher 3: Wild Hunt', platforms: ['pc', 'xb', 'ps'], origin: 'PL', hours: 52 });
  });

  it('covers every platform', () => {
    for (const p of Object.keys(PLATFORMS)) expect(list.filter((g) => g.platforms.includes(p as never)).length, p).toBeGreaterThanOrEqual(60);
  });

  it('only uses known codes', () => {
    for (const g of list) {
      for (const x of g.genres) expect(x in GENRES).toBe(true);
      for (const x of g.types) expect(x in GAME_TYPES).toBe(true);
    }
  });
});

describe('Wikidata labels to filters', () => {
  it('maps platforms', () => {
    expect(platformsFrom(['Microsoft Windows', 'PlayStation 5', 'Xbox Series X and Series S', 'Meta Quest 3', 'Android', 'iOS', 'Nintendo Switch'])).toEqual(['pc', 'xb', 'ps', 'vr', 'mob']);
    expect(platformsFrom(['PlayStation 3'])).toEqual([]);
  });
  it('maps genres, modes and country', () => {
    expect(genresFrom(['action-adventure game', 'open world', 'role-playing video game'])).toEqual(['act', 'adv', 'rpg', 'ow']);
    expect(typesFrom(['single-player video game', 'multiplayer video game', 'cooperative video game'])).toEqual(['sp', 'mp', 'co']);
    expect(originFrom(['United States of America'])).toBe('US');
    expect(originFrom(['Japan'])).toBe('JP');
  });
  it('tells game pages from others', () => {
    expect(isGamePage({ title: 'Inside (video game)', description: '' })).toBe(true);
    expect(isGamePage({ title: 'Minecraft', description: '2011 video game' })).toBe(true);
    expect(isGamePage({ title: 'Tomb Raider', description: 'Media franchise' })).toBe(false);
    expect(isGamePage({ title: 'Tekken', description: 'Fighting video game series' })).toBe(false);
  });
});

describe('helpers', () => {
  it('formats play time and reads YouTube links', () => {
    expect(fmtHours(52)).toBe('52 h');
    expect(fmtHours(8.5)).toBe('8.5 h');
    expect(fmtHours(0)).toBe('No ending');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('not a link')).toBe('');
  });
  it('offers searches for missing links', () => {
    const g = blankGame({ title: 'Celeste', officialUrl: 'https://www.celestegame.com/', wikiUrl: 'https://en.wikipedia.org/wiki/Celeste_(video_game)' });
    expect(gameLinks(g).map((l) => [l.label, l.found])).toEqual([['Official site', true], ['Search IGN', false], ['Wikipedia', true], ['Search HowLongToBeat', false]]);
  });
});

// A tiny stand-in for the Wikipedia and Wikidata APIs.
function fakeWeb() {
  const pages: Record<string, { description: string; qid: string; image?: string }> = {
    'The Witcher 3: Wild Hunt': { description: '2015 video game', qid: 'Q1', image: 'https://upload.wikimedia.org/w3.jpg' },
    'God of War (2018 video game)': { description: '2018 video game', qid: 'Q2' },
    'Celeste (video game)': { description: '2018 video game', qid: 'Q3' },
    Celeste: { description: 'Disambiguation', qid: 'Q0' },
  };
  const entities: Record<string, any> = {
    Q1: { claims: {
      P856: [{ rank: 'normal', mainsnak: { datavalue: { value: 'https://www.thewitcher.com/' } } }],
      P5385: [{ rank: 'normal', mainsnak: { datavalue: { value: 'the-witcher-3-wild-hunt' } } }],
      P1651: [{ rank: 'normal', mainsnak: { datavalue: { value: 'c0i88t0Kacs' } } }],
      P2816: [{ rank: 'normal', mainsnak: { datavalue: { value: '10270' } } }],
    } },
    Q2: { claims: { P856: [{ rank: 'deprecated', mainsnak: { datavalue: { value: 'https://old.example/' } } }, { rank: 'normal', mainsnak: { datavalue: { value: 'https://godofwar.playstation.com/' } } }] } },
    Q3: {
      claims: {
        P400: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'QW' } } } }, { rank: 'normal', mainsnak: { datavalue: { value: { id: 'QX' } } } }],
        P136: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'QP' } } } }],
        P404: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'QS' } } } }],
        P495: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'QC' } } } }],
        P577: [{ rank: 'normal', mainsnak: { datavalue: { value: { time: '+2018-01-25T00:00:00Z' } } } }],
      },
    },
  };
  const labels: Record<string, string> = { QW: 'Microsoft Windows', QX: 'Xbox One', QP: 'platform game', QS: 'single-player video game', QC: 'Canada' };
  const asked: string[] = [];
  const get = async (url: string) => {
    asked.push(url);
    const u = new URL(url);
    if (u.hostname === 'en.wikipedia.org' && u.pathname === '/w/api.php') {
      const titles = (u.searchParams.get('titles') ?? '').split('|');
      const normalized: any[] = [];
      const out = titles.map((t) => {
        const p = pages[t];
        return p
          ? { title: t, description: p.description, extract: `${t} is a game.`, // Game covers are non-free images: Wikipedia lists them only when asked for any license.
            thumbnail: p.image && u.searchParams.get('pilicense') === 'any' ? { source: p.image } : undefined, pageprops: { wikibase_item: p.qid, ...(p.description === 'Disambiguation' ? { disambiguation: '' } : {}) } }
          : { title: t, missing: true };
      });
      return JSON.stringify({ query: { normalized, pages: out } });
    }
    if (u.hostname === 'en.wikipedia.org' && u.pathname.startsWith('/w/rest.php')) {
      const q = u.searchParams.get('q') ?? '';
      return JSON.stringify({ pages: q.startsWith('Celeste') ? [{ title: 'Celeste (video game)', description: '2018 video game' }, { title: 'Celeste (film)', description: '2012 film' }] : [] });
    }
    if (u.hostname === 'www.wikidata.org') {
      const ids = (u.searchParams.get('ids') ?? '').split('|');
      if (u.searchParams.get('props') === 'labels') return JSON.stringify({ entities: Object.fromEntries(ids.map((id) => [id, { labels: { en: { value: labels[id] } } }])) });
      return JSON.stringify({ entities: Object.fromEntries(ids.map((id) => [id, entities[id] ?? { missing: '' }])) });
    }
    if (u.hostname === 'www.youtube.com') return '"videoRenderer":{"videoId":"abcdefghijk","x":1,"title":{"runs":[{"text":"Game official trailer"}]';
    throw new Error(`404 ${url}`);
  };
  return { get, asked };
}

describe('GameStore', () => {
  it('adds the top 500 once and fills links from Wikipedia and Wikidata', async () => {
    const web = fakeWeb();
    const store = new GameStore(new MemoryStorage().games, { get: web.get }, async () => {});
    await store.init();
    const first = await store.addTop();
    expect(first).toEqual({ added: 500, skipped: 0 });
    await store.fetchDetails([]); // lookups started by addTop run in the background
    await new Promise((r) => setTimeout(r, 0));
    while (store.progress) await new Promise((r) => setTimeout(r, 5));
    const games = store.getSnapshot().games;
    const witcher = games.find((g) => g.rank === 1)!;
    expect(witcher).toMatchObject({
      officialUrl: 'https://www.thewitcher.com/',
      ignUrl: 'https://www.ign.com/games/the-witcher-3-wild-hunt',
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Witcher_3%3A_Wild_Hunt',
      trailerId: 'c0i88t0Kacs',
      coverUrl: 'https://upload.wikimedia.org/w3.jpg',
      metadataStatus: 'ok',
    });
    expect(witcher.links).toEqual([{ label: 'HowLongToBeat', url: 'https://howlongtobeat.com/game/10270' }]);
    // The list's own article name is used, and deprecated values are skipped.
    expect(games.find((g) => g.title === 'God of War')).toMatchObject({ officialUrl: 'https://godofwar.playstation.com/', wikiUrl: 'https://en.wikipedia.org/wiki/God_of_War_(2018_video_game)' });
    // "Celeste" is a disambiguation page; the "(video game)" article is found next.
    expect(games.find((g) => g.title === 'Celeste')).toMatchObject({ wikiUrl: 'https://en.wikipedia.org/wiki/Celeste_(video_game)', metadataStatus: 'ok' });
    // Games Wikipedia doesn't know are marked, with no made-up links.
    expect(games.find((g) => g.title === 'Hades')).toMatchObject({ metadataStatus: 'failed', wikiUrl: '', officialUrl: '' });
    // Filters still come from the list.
    expect(games.find((g) => g.title === 'Celeste')).toMatchObject({ platforms: ['pc', 'xb', 'ps'], origin: 'CA', hours: 8 });

    expect(await store.addTop()).toEqual({ added: 0, skipped: 500 });
    // About 25 batches of 20, plus retries: far fewer requests than one per game.
    expect(web.asked.filter((u) => u.includes('wikidata')).length).toBeLessThan(40);
  });

  it('adds a game from a search with its platforms, genres, type and origin', async () => {
    const web = fakeWeb();
    const store = new GameStore(new MemoryStorage().games, { get: web.get });
    await store.init();
    const hits = await store.search('Celeste');
    expect(hits.map((h) => h.title)).toEqual(['Celeste (video game)']);
    const { game, existed } = await store.addFromArticle(hits[0].title);
    expect(existed).toBe(false);
    expect(game).toMatchObject({ title: 'Celeste', year: 2018, platforms: ['pc', 'xb'], genres: ['pla'], types: ['sp'], origin: 'CA', wikiUrl: 'https://en.wikipedia.org/wiki/Celeste_(video_game)' });
    expect((await store.addFromArticle('Celeste (video game)')).existed).toBe(true);
    // The top 500 doesn't add it twice, but gives it its rank.
    await store.addTop();
    expect(store.getSnapshot().games.filter((g) => g.title === 'Celeste')).toHaveLength(1);
    expect(store.getSnapshot().games.find((g) => g.title === 'Celeste')!.rank).toBeGreaterThan(0);
  });

  it('keeps games added by hand, blocks duplicates and finds a trailer', async () => {
    const web = fakeWeb();
    const storage = new MemoryStorage();
    const store = new GameStore(storage.games, { get: web.get });
    await store.init();
    const draft = blankGame({ title: 'My Indie Game', year: 2024, platforms: ['pc'], hours: 6, officialUrl: 'https://indie.example/', ignUrl: 'https://www.ign.com/games/my-indie-game' });
    expect((await store.addManual(draft)).existed).toBe(false);
    expect((await store.addManual(blankGame({ title: 'my indie game', year: 2024 }))).existed).toBe(true);
    await expect(store.update((await store.addManual(blankGame({ title: 'Other' }))).game.id, { title: 'My Indie Game' })).rejects.toThrow(/duplicate/);
    const id = store.getSnapshot().games.find((g) => g.title === 'My Indie Game')!.id;
    expect(await store.fetchTrailer(id)).toBe('abcdefghijk');

    const again = new GameStore(storage.games, null);
    await again.init();
    expect(again.getSnapshot().games.find((g) => g.id === id)).toMatchObject({ officialUrl: 'https://indie.example/', trailerId: 'abcdefghijk', hours: 6 });
    // Backups round-trip without duplicating.
    const json = again.exportJson();
    expect(await again.importJson(json)).toEqual({ added: 0, skipped: 2 });
    const fresh = new GameStore(new MemoryStorage().games, null);
    expect(await fresh.importJson(json)).toEqual({ added: 2, skipped: 0 });
  });

  it('waits and retries when Wikipedia refuses, and says why when it keeps refusing', async () => {
    const web = fakeWeb();
    let refusals = 2;
    const waits: number[] = [];
    const flaky = async (url: string) => {
      if (url.includes('wikipedia.org/w/api.php') && refusals-- > 0) throw new Error('The site answered 429 Too Many Requests');
      return web.get(url);
    };
    const store = new GameStore(new MemoryStorage().games, { get: flaky }, async (ms) => { waits.push(ms); });
    await store.init();
    await store.addManual(blankGame({ title: 'The Witcher 3: Wild Hunt', year: 2015 }));
    await store.fetchDetails(store.getSnapshot().games.map((g) => g.id));
    expect(store.getSnapshot().games[0]).toMatchObject({ metadataStatus: 'ok', coverUrl: 'https://upload.wikimedia.org/w3.jpg' });
    expect(waits).toEqual([5000, 20000]);
    expect(store.lastError).toBe('');

    const down = new GameStore(new MemoryStorage().games, { get: async () => { throw new Error('The site answered 429 Too Many Requests'); } }, async () => {});
    await down.init();
    for (let i = 0; i < 45; i++) await down.addManual(blankGame({ title: `Game ${i}` }));
    await down.fetchDetails(down.getSnapshot().games.map((g) => g.id));
    expect(down.getSnapshot().games.every((g) => g.metadataStatus === 'failed')).toBe(true);
    expect(down.lastError).toMatch(/429/);
    expect(down.progress).toBeNull();
  });
});
