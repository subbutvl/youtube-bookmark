import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { IconEye, IconRefresh, IconSearch, IconStar } from './components/Icons';
import { MediaDetail } from './components/MediaDetail';
import { fmtVotes, MediaAddDialog, MediaEditDialog, MediaManyDialog, Poster } from './components/MediaDialogs';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { ShowMore } from './components/ShowMore';
import { isMediaUrl } from './lib/media-sources';
import { blankItem, COUNTRIES, KIND_LABELS, KIND_NOUN, STATUS_LABELS, type MediaItem, type MediaKind, type WatchStatus } from './lib/media-types';
import { pickTextFile, saveTextFile } from './lib/platform';
import { isTauri } from './lib/storage';
import { fold } from './lib/view';
import { errorText, MEDIA_COUNTRY_PREF, useLinks, useLinkStore, useMedia, useMediaStore, usePref, useToast, type Density, type Shell } from './state';

type Modal =
  | { kind: 'add'; text: string }
  | { kind: 'many'; text: string }
  | { kind: 'open'; id: string }
  | { kind: 'edit'; item: MediaItem; isNew: boolean }
  | { kind: 'relink'; id: string }
  | { kind: 'settings' }
  | { kind: 'help' }
  | null;

type SortKey = 'added' | 'imdb' | 'rt' | 'mine' | 'year-desc' | 'year-asc' | 'title';
const SORTS: Record<SortKey, string> = {
  added: 'Recently added', imdb: 'IMDb rating', rt: 'Rotten Tomatoes', mine: 'My rating', 'year-desc': 'Newest', 'year-asc': 'Oldest', title: 'Name',
};
const STATUS_FILTERS: (WatchStatus | 'all')[] = ['all', 'want', 'watching', 'watched'];
const NONE = '\u0000none';
const PAGE = 120;

// Titles left half-done (app closed mid-lookup) are looked up again once per launch.
let resumed = false;

const byNum = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1);

/** The Movies or TV Shows tab: a poster grid with ratings and platforms, filters, and each title's page. */
export function MoviesView({ shell, kind }: { shell: Shell; kind: MediaKind }) {
  const store = useMediaStore();
  const lib = useMedia();
  const linkStore = useLinkStore();
  const allLinks = useLinks().links;
  const toast = useToast();
  const { theme, setThemePref } = shell;
  const [density, setDensity] = usePref<Density>('density', 'comfortable');
  const [sort, setSort] = usePref<SortKey>(`mediaSort.${kind}`, 'added');
  const [country, setCountry] = usePref<string>(MEDIA_COUNTRY_PREF, 'IN');
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WatchStatus | 'all'>('all');
  const [provider, setProvider] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [confirmMove, setConfirmMove] = useState(false);
  const shownQuery = useDeferredValue(query);

  const mine = useMemo(() => lib.items.filter((i) => i.kind === kind), [lib.items, kind]);
  const facets = useMemo(() => {
    const count = (pick: (i: MediaItem) => string[]) => {
      const n = new Map<string, number>();
      for (const i of mine) for (const k of new Set(pick(i))) n.set(k, (n.get(k) ?? 0) + 1);
      return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    return {
      providers: count((i) => (i.watch.length ? i.watch.map((w) => w.provider) : [NONE])),
      genres: count((i) => i.genres),
      languages: count((i) => (i.language ? [i.language] : [])),
      status: count((i) => [i.status]),
    };
  }, [mine]);

  const items = useMemo(() => {
    const q = fold(shownQuery.trim());
    const list = mine.filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (provider && !(provider === NONE ? !i.watch.length : i.watch.some((w) => w.provider === provider))) return false;
      if (genre && !i.genres.includes(genre)) return false;
      if (language && i.language !== language) return false;
      if (q && !fold([i.title, i.originalTitle, i.language, i.genres.join(' '), i.notes, i.watch.map((w) => w.provider).join(' '), i.year ?? ''].join(' ')).includes(q)) return false;
      return true;
    });
    const cmp: Record<SortKey, (a: MediaItem, b: MediaItem) => number> = {
      added: (a, b) => b.createdAt.localeCompare(a.createdAt),
      imdb: (a, b) => byNum(a.imdbRating, b.imdbRating) || byNum(a.imdbVotes, b.imdbVotes),
      rt: (a, b) => byNum(a.rtScore, b.rtScore),
      mine: (a, b) => byNum(a.myRating, b.myRating),
      'year-desc': (a, b) => byNum(a.year, b.year),
      'year-asc': (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort((a, b) => cmp[sort](a, b) || a.title.localeCompare(b.title));
  }, [mine, shownQuery, status, provider, genre, language, sort]);
  useEffect(() => setLimit(PAGE), [shownQuery, status, provider, genre, language, sort]);

  const movable = useMemo(() => allLinks.filter((l) => isMediaUrl(l.url)), [allLinks]);
  const pending = mine.filter((i) => i.metadataStatus === 'pending' && !store.fetching.has(i.id));
  const failed = mine.filter((i) => i.metadataStatus === 'failed');

  useEffect(() => {
    if (resumed || !store.canFetch) return;
    resumed = true;
    const left = store.getSnapshot().items.filter((i) => i.metadataStatus === 'pending');
    if (left.length) void store.fetchDetails(left.map((i) => i.id));
  }, [store]);

  const quickAdd = async (text: string) => {
    if (!store.canFetch) {
      setModal({ kind: 'edit', item: blankItem(kind, { title: text }), isNew: true });
      return true;
    }
    setModal({ kind: 'add', text });
    return true;
  };

  const added = (item: MediaItem, existed: boolean) => {
    if (item.kind !== kind) {
      toast({ text: `${existed ? 'Already saved' : 'Saved'} in ${KIND_LABELS[item.kind]}: ${item.title}.`, action: { label: `Show ${KIND_LABELS[item.kind]}`, run: () => shell.setMode(item.kind === 'tv' ? 'tv' : 'movies') } }, 6000);
      setModal(null);
      return;
    }
    if (existed) toast({ text: `${item.title} is already saved.` });
    setModal({ kind: 'open', id: item.id });
  };

  const addTop = async () => {
    try {
      const r = await store.addTop(kind);
      toast({ text: r.added ? `Added ${r.added} ${kind === 'tv' ? 'TV shows' : 'movies'}${r.skipped ? ` (${r.skipped} were already saved)` : ''}. Details are being looked up.` : 'They’re all saved already.' }, 8000);
      setSort('added');
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  const moveLinks = async () => {
    if (!confirmMove) return setConfirmMove(true);
    setConfirmMove(false);
    const links = movable;
    try {
      const r = await store.addLinks(links.map((l) => l.url));
      await linkStore.deleteLinks(links.map((l) => l.id));
      toast({ text: `Moved ${links.length} link${links.length === 1 ? '' : 's'} out of Links: ${r.added} new title${r.added === 1 ? '' : 's'}, ${r.existed} already saved.` }, 8000);
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  const exportAll = async () => {
    try {
      if (await saveTextFile(`movies-and-tv-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson(), 'json')) toast({ text: 'Movies and TV shows exported.' });
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };
  const importAll = async () => {
    try {
      const f = await pickTextFile();
      if (!f || !('text' in f)) return;
      const r = await store.importJson(f.text);
      toast({ text: `Imported ${r.added} title${r.added === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped} already saved` : ''}.` }, 8000);
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
      if (e.key === '/') document.getElementById('media-search')?.focus();
      else if (e.key === '?') setModal({ kind: 'help' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [modal]);

  const opened = modal?.kind === 'open' ? lib.items.find((i) => i.id === modal.id) : undefined;
  const relinking = modal?.kind === 'relink' ? lib.items.find((i) => i.id === modal.id) : undefined;
  const label = KIND_LABELS[kind];
  const facetNav = (title: string, list: [string, number][], value: string, set: (v: string) => void, show = (k: string) => k) =>
    list.length > 0 && (
      <div className="nav-group">
        <div className="nav-heading">{title}</div>
        {list.slice(0, 14).map(([k, n]) => (
          <button type="button" key={k} className="nav-item" aria-pressed={value === k} onClick={() => set(value === k ? '' : k)}>
            <span className="label">{show(k)}</span>
            <span className="count">{n}</span>
          </button>
        ))}
      </div>
    );

  return (
    <div className="app">
      <Header
        mode={kind === 'tv' ? 'tv' : 'movies'}
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={quickAdd}
        onAddMany={(text) => setModal({ kind: 'many', text })}
        onHelp={() => setModal({ kind: 'help' })}
        onSettings={() => setModal({ kind: 'settings' })}
      />
      <div className="body">
        <nav className="sidebar" aria-label={label}>
          <div className="nav-group">
            {STATUS_FILTERS.map((s) => (
              <button type="button" key={s} className="nav-item" aria-pressed={status === s} onClick={() => setStatus(s)}>
                <span className="label">{s === 'all' ? `All ${label.toLowerCase()}` : STATUS_LABELS[s]}</span>
                <span className="count">{s === 'all' ? mine.length : facets.status.find(([k]) => k === s)?.[1] ?? ''}</span>
              </button>
            ))}
          </div>
          {facetNav('Where to watch', facets.providers, provider, setProvider, (k) => (k === NONE ? 'Not on a platform' : k))}
          {facetNav('Languages', facets.languages, language, setLanguage)}
          {facetNav('Genres', facets.genres, genre, setGenre)}
          <div className="nav-group media-tools">
            <button type="button" className="btn" onClick={() => void addTop()}><IconStar size={14} />Add IMDb top 100</button>
            {movable.length > 0 && (
              <button type="button" className={`btn${confirmMove ? ' btn-primary' : ''}`} onBlur={() => setConfirmMove(false)} onClick={() => void moveLinks()} title="IMDb, Rotten Tomatoes, JustWatch and film articles saved in the Links or Wikipedia tabs">
                {confirmMove ? `Move ${movable.length} now?` : `Move ${movable.length} movie link${movable.length === 1 ? '' : 's'} from Links`}
              </button>
            )}
            <label className="field-inline hint">
              Platforms in
              <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
          </div>
        </nav>

        <main className="main">
          <div className="toolbar">
            <div className="search">
              <IconSearch />
              <label htmlFor="media-search" className="sr-only">Search {label}</label>
              <input id="media-search" className="input" type="search" placeholder={`Search your ${label.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="sort">
              Sort
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
              </select>
            </label>
            {(provider || genre || language) && (
              <button type="button" className="btn btn-sm" onClick={() => { setProvider(''); setGenre(''); setLanguage(''); }}>Clear filters</button>
            )}
            {store.canFetch && pending.length + failed.length > 0 && !store.progress && (
              <button type="button" className="btn btn-sm" onClick={() => void store.fetchDetails([...pending, ...failed].map((i) => i.id))} title="Look up titles whose details are missing">
                <IconRefresh size={13} />Look up {pending.length + failed.length} missing
              </button>
            )}
            <span className="result-count">{items.length.toLocaleString()} {items.length === 1 ? KIND_NOUN[kind] : label.toLowerCase()}</span>
          </div>

          {store.progress && (
            <div className="banner">
              <span className="grow">Looking up details: {store.progress.done} of {store.progress.total}</span>
              <div className="progress"><div style={{ width: `${(100 * store.progress.done) / Math.max(1, store.progress.total)}%` }} /></div>
            </div>
          )}

          {!mine.length ? (
            <div className="empty">
              <h2>Your {label.toLowerCase()}</h2>
              <span>Type a name in any language, or paste an IMDb, Wikipedia or JustWatch link, in the box at the top. Each title gets its poster, ratings, synopsis, trailer and where to watch it.</span>
              <div className="chips">
                <button type="button" className="btn btn-primary" onClick={() => void addTop()}><IconStar size={14} />Start with the IMDb top 100</button>
                <button type="button" className="btn" onClick={() => setModal({ kind: 'add', text: '' })}>Search for a {KIND_NOUN[kind]}</button>
              </div>
              {!isTauri() && <span className="hint">Details are looked up in the desktop app only.</span>}
            </div>
          ) : !items.length ? (
            <div className="empty"><h2>Nothing matches</h2><span>Try another search or clear the filters.</span></div>
          ) : (
            <div className={`mgrid${density === 'compact' ? ' compact' : ''}`}>
              {items.slice(0, limit).map((i) => (
                <article className="mcard" key={i.id}>
                  <button type="button" className="mcard-open" onClick={() => setModal({ kind: 'open', id: i.id })} title={i.synopsis || i.title}>
                    <div className="mposter">
                      <Poster url={i.posterUrl} title={i.title} className="mposter-img" />
                      {i.imdbRating != null && <span className="mbadge">★ {i.imdbRating.toFixed(1)}</span>}
                      {store.fetching.has(i.id) && <span className="mbadge busy">…</span>}
                      {i.status !== 'none' && <span className={`mstatus ${i.status}`}>{STATUS_LABELS[i.status]}</span>}
                    </div>
                    <div className="mcard-body">
                      <b className="mcard-title">{i.title}</b>
                      <span className="hint ellipsis">{[i.year, i.language, i.rtScore != null ? `RT ${i.rtScore}%` : '', i.imdbVotes ? `${fmtVotes(i.imdbVotes)} votes` : ''].filter(Boolean).join(' · ')}</span>
                      {i.watch.length > 0 && <span className="mproviders ellipsis">{[...new Set(i.watch.map((w) => w.provider))].join(' · ')}</span>}
                    </div>
                  </button>
                  <div className="card-actions">
                    <button type="button" aria-pressed={i.status === 'want'} title={i.status === 'want' ? 'Remove from want to watch' : 'Want to watch'} aria-label="Want to watch" onClick={() => void store.update(i.id, { status: i.status === 'want' ? 'none' : 'want' })}><IconStar size={14} /></button>
                    <button type="button" aria-pressed={i.status === 'watched'} title={i.status === 'watched' ? 'Mark not watched' : 'Mark watched'} aria-label="Watched" onClick={() => void store.update(i.id, { status: i.status === 'watched' ? 'none' : 'watched' })}><IconEye size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {items.length > limit && <ShowMore left={items.length - limit} noun={label.toLowerCase()} onMore={() => setLimit((l) => l + PAGE)} />}
        </main>
      </div>

      {modal?.kind === 'add' && (
        <MediaAddDialog
          kind={kind}
          initialText={modal.text}
          onClose={() => setModal(null)}
          onAdded={added}
          onManual={(item) => setModal({ kind: 'edit', item, isNew: true })}
        />
      )}
      {relinking && (
        <MediaAddDialog kind={relinking.kind} initialText="" relink={relinking} onClose={() => setModal({ kind: 'open', id: relinking.id })} onAdded={() => setModal({ kind: 'open', id: relinking.id })} onManual={() => {}} />
      )}
      {modal?.kind === 'many' && <MediaManyDialog kind={kind} initialText={modal.text} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && (
        <MediaEditDialog
          item={modal.item}
          isNew={modal.isNew}
          onClose={() => setModal(modal.isNew ? null : { kind: 'open', id: modal.item.id })}
          onSaved={(item) => (item.kind === kind ? setModal({ kind: 'open', id: item.id }) : added(item, false))}
        />
      )}
      {opened && (
        <MediaDetail
          key={opened.id}
          item={opened}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ kind: 'edit', item: opened, isNew: false })}
          onRelink={() => setModal({ kind: 'relink', id: opened.id })}
        />
      )}
      {modal?.kind === 'settings' && (
        <SettingsDialog
          onClose={() => setModal(null)}
          theme={shell.themePref}
          setTheme={setThemePref}
          density={density}
          setDensity={setDensity}
          data={{
            label: 'Import and export movies and TV shows',
            hint: 'A JSON file with every title, its links, platforms and your notes.',
            onImport: () => { setModal(null); void importAll(); },
            onExport: () => { setModal(null); void exportAll(); },
          }}
        />
      )}
      {modal?.kind === 'help' && <ShortcutsDialog onClose={() => setModal(null)} />}
    </div>
  );
}
