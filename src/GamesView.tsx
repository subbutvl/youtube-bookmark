import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { GameAddDialog, GameDetail, GameEditDialog } from './components/GameDialogs';
import { Header } from './components/Header';
import { IconCheck, IconRefresh, IconSearch, IconStar } from './components/Icons';
import { Poster } from './components/MediaDialogs';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { ShowMore } from './components/ShowMore';
import {
  blankGame, fmtHours, GAME_TYPES, GENRES, HOUR_BUCKETS, originLabel, PLATFORMS, PLAY_LABELS,
  type Game, type GameType, type Genre, type HourBucket, type Platform, type PlayStatus,
} from './lib/game-types';
import { pickTextFile, saveTextFile } from './lib/platform';
import { isTauri } from './lib/storage';
import { fold } from './lib/view';
import { errorText, useGames, useGameStore, usePref, useToast, type Density, type Shell } from './state';

type Modal =
  | { kind: 'add'; text: string }
  | { kind: 'open'; id: string }
  | { kind: 'edit'; game: Game; isNew: boolean }
  | { kind: 'settings' }
  | { kind: 'help' }
  | null;

type SortKey = 'rank' | 'added' | 'title' | 'year-desc' | 'year-asc' | 'short' | 'long' | 'mine';
const SORTS: Record<SortKey, string> = {
  rank: 'Top ranked', added: 'Recently added', title: 'Name', 'year-desc': 'Newest', 'year-asc': 'Oldest', short: 'Shortest first', long: 'Longest first', mine: 'My rating',
};
type StatusFilter = PlayStatus | 'all';
const STATUS_FILTERS: StatusFilter[] = ['all', 'want', 'playing', 'finished', 'dropped'];
const PAGE = 120;


interface Filters {
  platform: Platform | '';
  genre: Genre | '';
  origin: string;
  type: GameType | '';
  hours: HourBucket | '';
}
const NO_FILTERS: Filters = { platform: '', genre: '', origin: '', type: '', hours: '' };

/** The Games tab: the top 500 and games added by hand, with filters by platform, genre, origin, type and play time. */
export function GamesView({ shell }: { shell: Shell }) {
  const store = useGameStore();
  const lib = useGames();
  const toast = useToast();
  const { theme, setThemePref } = shell;
  const [density, setDensity] = usePref<Density>('density', 'comfortable');
  const [sort, setSort] = usePref<SortKey>('gameSort', 'rank');
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const shownQuery = useDeferredValue(query);
  const shownF = useDeferredValue(f);
  const games = lib.games;

  const facets = useMemo(() => {
    const count = <K extends string>(pick: (g: Game) => K[]) => {
      const n = new Map<K, number>();
      for (const g of games) for (const k of new Set(pick(g))) n.set(k, (n.get(k) ?? 0) + 1);
      return n;
    };
    return {
      platforms: count((g) => g.platforms),
      genres: count((g) => g.genres),
      origins: count((g) => (g.origin ? [g.origin] : [])),
      types: count((g) => g.types),
      hours: count((g) => (g.hours == null ? [] : (Object.keys(HOUR_BUCKETS) as HourBucket[]).filter((b) => HOUR_BUCKETS[b].test(g.hours!)))),
      status: count((g) => [g.status]),
    };
  }, [games]);

  const items = useMemo(() => {
    const q = fold(shownQuery.trim());
    const list = games.filter((g) => {
      if (status !== 'all' && g.status !== status) return false;
      if (shownF.platform && !g.platforms.includes(shownF.platform)) return false;
      if (shownF.genre && !g.genres.includes(shownF.genre)) return false;
      if (shownF.origin && g.origin !== shownF.origin) return false;
      if (shownF.type && !g.types.includes(shownF.type)) return false;
      if (shownF.hours && (g.hours == null || !HOUR_BUCKETS[shownF.hours].test(g.hours))) return false;
      if (q && !fold([g.title, g.year ?? '', g.developer, originLabel(g.origin), g.genres.map((x) => GENRES[x]).join(' '), g.platforms.map((x) => PLATFORMS[x]).join(' '), g.notes].join(' ')).includes(q)) return false;
      return true;
    });
    const hours = (g: Game, empty: number) => (g.hours == null ? empty : g.hours === 0 ? empty : g.hours);
    const cmp: Record<SortKey, (a: Game, b: Game) => number> = {
      rank: (a, b) => (a.rank ?? 1e6) - (b.rank ?? 1e6) || b.createdAt.localeCompare(a.createdAt),
      added: (a, b) => b.createdAt.localeCompare(a.createdAt),
      title: (a, b) => a.title.localeCompare(b.title),
      'year-desc': (a, b) => (b.year ?? -1) - (a.year ?? -1),
      'year-asc': (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
      short: (a, b) => hours(a, 1e6) - hours(b, 1e6),
      long: (a, b) => hours(b, -1) - hours(a, -1),
      mine: (a, b) => (b.myRating ?? -1) - (a.myRating ?? -1),
    };
    return list.sort((a, b) => cmp[sort](a, b) || a.title.localeCompare(b.title));
  }, [games, shownQuery, status, shownF, sort]);
  useEffect(() => setLimit(PAGE), [shownQuery, status, shownF, sort]);

  const pending = games.filter((g) => g.metadataStatus === 'pending' && !store.fetching.has(g.id));
  const failed = games.filter((g) => g.metadataStatus === 'failed');
  const anyFilter = Object.values(f).some(Boolean);


  const quickAdd = async (text: string) => {
    setModal(store.canFetch ? { kind: 'add', text } : { kind: 'edit', game: blankGame({ title: text }), isNew: true });
    return true;
  };

  const added = (game: Game, existed: boolean) => {
    if (existed) toast({ text: `${game.title} is already saved.` });
    setModal({ kind: 'open', id: game.id });
  };

  const addTop = async () => {
    try {
      const r = await store.addTop();
      toast({ text: r.added ? `Added ${r.added} games${r.skipped ? ` (${r.skipped} were already saved)` : ''}. Their links and covers are being looked up.` : 'They’re all saved already.' }, 8000);
      setSort('rank');
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  const exportAll = async () => {
    try {
      if (await saveTextFile(`games-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson(), 'json')) toast({ text: 'Games exported.' });
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };
  const importAll = async () => {
    try {
      const file = await pickTextFile();
      if (!file || !('text' in file)) return;
      const r = await store.importJson(file.text);
      toast({ text: `Imported ${r.added} game${r.added === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped} already saved` : ''}.` }, 8000);
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  // Keyboard: / searches, ? shows help.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (modal || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === '/') document.getElementById('game-search')?.focus();
      else if (e.key === '?') setModal({ kind: 'help' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [modal]);

  const opened = modal?.kind === 'open' ? games.find((g) => g.id === modal.id) : undefined;

  const facetNav = <K extends string>(title: string, key: keyof Filters, all: Record<K, string> | null, counts: Map<K, number>, show: (k: K) => string = (k) => all?.[k] ?? k) => {
    const keys = (all ? (Object.keys(all) as K[]) : [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))).filter((k) => counts.get(k));
    if (!keys.length) return null;
    const value = f[key] as string;
    return (
      <div className="nav-group">
        <div className="nav-heading">{title}</div>
        {keys.map((k) => (
          <button type="button" key={k} className="nav-item" aria-pressed={value === k} onClick={() => setF({ ...f, [key]: value === k ? '' : k })}>
            <span className="label">{show(k)}</span>
            <span className="count">{counts.get(k)}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="app">
      <Header
        mode="games"
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={quickAdd}
        onAddMany={() => {}}
        onHelp={() => setModal({ kind: 'help' })}
        onSettings={() => setModal({ kind: 'settings' })}
      />
      <div className="body">
        <nav className="sidebar" aria-label="Games">
          <div className="nav-group">
            {STATUS_FILTERS.map((s) => (
              <button type="button" key={s} className="nav-item" aria-pressed={status === s} onClick={() => setStatus(s)}>
                <span className="label">{s === 'all' ? 'All games' : PLAY_LABELS[s]}</span>
                <span className="count">{s === 'all' ? games.length : facets.status.get(s) ?? ''}</span>
              </button>
            ))}
          </div>
          {facetNav('Platform', 'platform', PLATFORMS, facets.platforms)}
          {facetNav('Type', 'type', GAME_TYPES, facets.types)}
          {facetNav('Play time', 'hours', Object.fromEntries(Object.entries(HOUR_BUCKETS).map(([k, v]) => [k, v.label])) as Record<HourBucket, string>, facets.hours)}
          {facetNav('Genre', 'genre', null, facets.genres, (k) => GENRES[k as Genre] ?? k)}
          {facetNav('Origin', 'origin', null, facets.origins, originLabel)}
          <div className="nav-group media-tools">
            <button type="button" className="btn" onClick={() => void addTop()}><IconStar size={14} />Add the top 500</button>
            <button type="button" className="btn" onClick={() => setModal({ kind: 'edit', game: blankGame(), isNew: true })}>Add a game by hand</button>
          </div>
        </nav>

        <main className="main">
          <div className="toolbar">
            <div className="search">
              <IconSearch />
              <label htmlFor="game-search" className="sr-only">Search games</label>
              <input id="game-search" className="input" type="search" placeholder="Search your games" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="sort">
              Sort
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
              </select>
            </label>
            {anyFilter && <button type="button" className="btn btn-sm" onClick={() => setF(NO_FILTERS)}>Clear filters</button>}
            {store.canFetch && pending.length + failed.length > 0 && !store.progress && (
              <button type="button" className="btn btn-sm" onClick={() => void store.fetchDetails([...pending, ...failed].map((g) => g.id))} title="Look up games whose links and covers are missing">
                <IconRefresh size={13} />Look up {pending.length + failed.length} missing
              </button>
            )}
            <span className="result-count">{items.length.toLocaleString()} {items.length === 1 ? 'game' : 'games'}</span>
          </div>
          {store.lastError && !store.progress && failed.length > 0 && (
            <div className="note">Couldn’t look up {failed.length} game{failed.length === 1 ? '' : 's'}: {store.lastError}. Use “Look up {pending.length + failed.length} missing” to try again.</div>
          )}

          {store.progress && (
            <div className="banner">
              <span className="grow">Looking up links and covers: {store.progress.done} of {store.progress.total}</span>
              <div className="progress"><div style={{ width: `${(100 * store.progress.done) / Math.max(1, store.progress.total)}%` }} /></div>
            </div>
          )}

          {!games.length ? (
            <div className="empty">
              <h2>Your games</h2>
              <span>Start with 500 of the best-known games on PC, Xbox, PlayStation, VR and mobile, each with its play time, official site, IGN page, Wikipedia article and trailer. Or add any game by name.</span>
              <div className="chips">
                <button type="button" className="btn btn-primary" onClick={() => void addTop()}><IconStar size={14} />Add the top 500</button>
                <button type="button" className="btn" onClick={() => (store.canFetch ? setModal({ kind: 'add', text: '' }) : setModal({ kind: 'edit', game: blankGame(), isNew: true }))}>Add a game</button>
              </div>
              {!isTauri() && <span className="hint">Links and covers are looked up in the desktop app only.</span>}
            </div>
          ) : !items.length ? (
            <div className="empty"><h2>Nothing matches</h2><span>Try another search or clear the filters.</span></div>
          ) : (
            <div className={`mgrid${density === 'compact' ? ' compact' : ''}`}>
              {items.slice(0, limit).map((g) => (
                <article className="mcard" key={g.id}>
                  <button type="button" className="mcard-open" onClick={() => setModal({ kind: 'open', id: g.id })} title={g.summary || g.title}>
                    <div className="mposter gposter">
                      <Poster url={g.coverUrl} title={g.title} className="mposter-img" />
                      {g.rank != null && sort === 'rank' && <span className="mbadge">#{g.rank}</span>}
                      {g.hours != null && <span className="mhours">{fmtHours(g.hours)}</span>}
                      {store.fetching.has(g.id) && <span className="mbadge busy">…</span>}
                      {g.status !== 'none' && <span className={`mstatus ${g.status}`}>{PLAY_LABELS[g.status]}</span>}
                    </div>
                    <div className="mcard-body">
                      <b className="mcard-title">{g.title}</b>
                      <span className="hint ellipsis">{[g.year, g.genres.slice(0, 2).map((x) => GENRES[x]).join(', '), g.origin ? originLabel(g.origin) : ''].filter(Boolean).join(' · ')}</span>
                      {g.platforms.length > 0 && <span className="mproviders ellipsis">{g.platforms.map((p) => PLATFORMS[p]).join(' · ')}</span>}
                    </div>
                  </button>
                  <div className="card-actions">
                    <button type="button" aria-pressed={g.status === 'want'} title={g.status === 'want' ? 'Remove from want to play' : 'Want to play'} aria-label="Want to play" onClick={() => void store.update(g.id, { status: g.status === 'want' ? 'none' : 'want' })}><IconStar size={14} /></button>
                    <button type="button" aria-pressed={g.status === 'finished'} title={g.status === 'finished' ? 'Not finished' : 'Mark finished'} aria-label="Finished" onClick={() => void store.update(g.id, { status: g.status === 'finished' ? 'none' : 'finished' })}><IconCheck size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {items.length > limit && <ShowMore left={items.length - limit} noun="games" onMore={() => setLimit((l) => l + PAGE)} />}
        </main>
      </div>

      {modal?.kind === 'add' && (
        <GameAddDialog initialText={modal.text} onClose={() => setModal(null)} onAdded={added} onManual={(game) => setModal({ kind: 'edit', game, isNew: true })} />
      )}
      {modal?.kind === 'edit' && (
        <GameEditDialog
          game={modal.game}
          isNew={modal.isNew}
          onClose={() => setModal(modal.isNew ? null : { kind: 'open', id: modal.game.id })}
          onSaved={(game) => setModal({ kind: 'open', id: game.id })}
        />
      )}
      {opened && <GameDetail key={opened.id} game={opened} onClose={() => setModal(null)} onEdit={() => setModal({ kind: 'edit', game: opened, isNew: false })} />}
      {modal?.kind === 'settings' && (
        <SettingsDialog
          onClose={() => setModal(null)}
          theme={shell.themePref}
          setTheme={setThemePref}
          density={density}
          setDensity={setDensity}
          data={{
            label: 'Import and export games',
            hint: 'A JSON file with every game, its links, status and your notes.',
            onImport: () => { setModal(null); void importAll(); },
            onExport: () => { setModal(null); void exportAll(); },
          }}
        />
      )}
      {modal?.kind === 'help' && <ShortcutsDialog onClose={() => setModal(null)} />}
    </div>
  );
}
