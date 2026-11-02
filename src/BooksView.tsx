import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { IconCheck, IconRefresh, IconSearch, IconStar } from './components/Icons';
import { Poster } from './components/MediaDialogs';
import { ReadAddDialog, ReadDetail, ReadEditDialog } from './components/ReadDialogs';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { ShowMore } from './components/ShowMore';
import { pickTextFile, saveTextFile } from './lib/platform';
import {
  ADAPTATION_LABELS, blankRead, MAGAZINE_CATEGORIES, READ_KINDS, READ_LABELS, READ_NOUN, READ_STATUS_LABELS,
  type AdaptationType, type ReadItem, type ReadKind, type ReadStatus,
} from './lib/read-types';
import { isTauri } from './lib/storage';
import { fold } from './lib/view';
import { errorText, usePref, useReading, useReadStore, useToast, type Density, type Shell } from './state';

type Modal =
  | { kind: 'add'; text: string }
  | { kind: 'open'; id: string }
  | { kind: 'edit'; item: ReadItem; isNew: boolean }
  | { kind: 'settings' }
  | { kind: 'help' }
  | null;

type SortKey = 'rank' | 'added' | 'title' | 'author' | 'year-desc' | 'year-asc' | 'mine';
const SORTS: Record<SortKey, string> = {
  rank: 'Top ranked', added: 'Recently added', title: 'Name', author: 'Author', 'year-desc': 'Newest', 'year-asc': 'Oldest', mine: 'My rating',
};
type StatusFilter = ReadStatus | 'all';
const STATUS_FILTERS: StatusFilter[] = ['all', 'want', 'reading', 'read', 'dropped'];
const PAGE = 120;
const TOP_SIZE: Record<ReadKind, number> = { book: 1000, comic: 1000, magazine: 150 };
const TOP_HINT: Record<ReadKind, string> = {
  book: '1000 of the best-known books: 881 in English (including classics read in translation) and 119 Tamil classics and novels.',
  comic: '1000 of the best-known English comics: graphic novels, superhero runs, indie series, newspaper strips, British comics and webcomics.',
  magazine: '150 magazines: 105 on movies, TV shows, photography, hobbies, space, travel and food, and 45 more on science, technology, design, music, gaming, ideas, nature and Tamil weeklies.',
};

// Works left half-done (app closed mid-lookup) are looked up again once per launch.
let resumed = false;

interface Filters {
  language: string;
  made: AdaptationType | 'any' | '';
  genre: string;
  category: string;
}
const NO_FILTERS: Filters = { language: '', made: '', genre: '', category: '' };

/** The Books tab: books, comics and magazines, each with its starter list, filters, synopsis, adaptations and links. */
export function BooksView({ shell }: { shell: Shell }) {
  const store = useReadStore();
  const lib = useReading();
  const toast = useToast();
  const { theme, setThemePref } = shell;
  const [density, setDensity] = usePref<Density>('density', 'comfortable');
  const [kind, setKind] = usePref<ReadKind>('readKind', 'book');
  const [sort, setSort] = usePref<SortKey>('readSort', 'rank');
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const shownQuery = useDeferredValue(query);
  const shownF = useDeferredValue(f);
  const all = lib.items;
  const works = useMemo(() => all.filter((x) => x.kind === kind), [all, kind]);
  const noun = READ_NOUN[kind];
  const plural = READ_LABELS[kind].toLowerCase();

  useEffect(() => {
    setF(NO_FILTERS);
    setStatus('all');
  }, [kind]);

  const facets = useMemo(() => {
    const count = (pick: (x: ReadItem) => string[]) => {
      const n = new Map<string, number>();
      for (const x of works) for (const k of new Set(pick(x))) if (k) n.set(k, (n.get(k) ?? 0) + 1);
      return n;
    };
    return {
      languages: count((x) => [x.language]),
      made: count((x) => (x.adaptations.length ? ['any', ...x.adaptations.map((a) => a.type)] : [])),
      genres: count((x) => x.genres),
      categories: count((x) => [x.category]),
      status: count((x) => [x.status]),
      kinds: new Map(READ_KINDS.map((k) => [k, all.filter((x) => x.kind === k).length])),
    };
  }, [works, all]);

  const items = useMemo(() => {
    const q = fold(shownQuery.trim());
    const list = works.filter((x) => {
      if (status !== 'all' && x.status !== status) return false;
      if (shownF.language && x.language !== shownF.language) return false;
      if (shownF.genre && !x.genres.includes(shownF.genre)) return false;
      if (shownF.category && x.category !== shownF.category) return false;
      if (shownF.made === 'any' && !x.adaptations.length) return false;
      if (shownF.made && shownF.made !== 'any' && !x.adaptations.some((a) => a.type === shownF.made)) return false;
      if (q && !fold([x.title, x.originalTitle, x.authors, x.year ?? '', x.language, x.category, x.publisher, x.genres.join(' '), x.adaptations.map((a) => a.title).join(' '), x.notes].join(' ')).includes(q)) return false;
      return true;
    });
    const surname = (x: ReadItem) => (x.authors.split(',')[0] ?? '').trim().split(/\s+/).pop() ?? '';
    const cmp: Record<SortKey, (a: ReadItem, b: ReadItem) => number> = {
      rank: (a, b) => (a.rank ?? 1e6) - (b.rank ?? 1e6) || b.createdAt.localeCompare(a.createdAt),
      added: (a, b) => b.createdAt.localeCompare(a.createdAt),
      title: (a, b) => a.title.localeCompare(b.title),
      author: (a, b) => (surname(a) || '￿').localeCompare(surname(b) || '￿'),
      'year-desc': (a, b) => (b.year ?? -1e5) - (a.year ?? -1e5),
      'year-asc': (a, b) => (a.year ?? 1e5) - (b.year ?? 1e5),
      mine: (a, b) => (b.myRating ?? -1) - (a.myRating ?? -1),
    };
    return list.sort((a, b) => cmp[sort](a, b) || a.title.localeCompare(b.title));
  }, [works, shownQuery, status, shownF, sort]);
  useEffect(() => setLimit(PAGE), [shownQuery, status, shownF, sort, kind]);

  const pending = works.filter((x) => x.metadataStatus === 'pending' && !store.fetching.has(x.id));
  const failed = works.filter((x) => x.metadataStatus === 'failed');
  const anyFilter = Object.values(f).some(Boolean);

  useEffect(() => {
    if (resumed || !store.canFetch) return;
    resumed = true;
    const left = store.getSnapshot().items.filter((x) => x.metadataStatus === 'pending' || x.metadataStatus === 'failed');
    if (left.length) void store.fetchDetails(left.map((x) => x.id));
  }, [store]);

  const quickAdd = async (text: string) => {
    setModal(store.canFetch ? { kind: 'add', text } : { kind: 'edit', item: blankRead(kind, { title: text }), isNew: true });
    return true;
  };

  const added = (item: ReadItem, existed: boolean) => {
    if (existed) toast({ text: `${item.title} is already saved.` });
    if (item.kind !== kind) setKind(item.kind);
    setModal({ kind: 'open', id: item.id });
  };

  const addTop = async () => {
    try {
      const r = await store.addTop(kind);
      toast({ text: r.added ? `Added ${r.added} ${plural}${r.skipped ? ` (${r.skipped} were already saved)` : ''}. Their covers, authors and links are being looked up.` : 'They’re all saved already.' }, 8000);
      setSort('rank');
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  const exportAll = async () => {
    try {
      if (await saveTextFile(`books-comics-magazines-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson(), 'json')) toast({ text: 'Books, comics and magazines exported.' });
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };
  const importAll = async () => {
    try {
      const file = await pickTextFile();
      if (!file || !('text' in file)) return;
      const r = await store.importJson(file.text);
      toast({ text: `Imported ${r.added}${r.skipped ? `, skipped ${r.skipped} already saved` : ''}.` }, 8000);
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
      if (e.key === '/') document.getElementById('read-search')?.focus();
      else if (e.key === '?') setModal({ kind: 'help' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [modal]);

  const opened = modal?.kind === 'open' ? all.find((x) => x.id === modal.id) : undefined;

  const facetNav = (title: string, key: keyof Filters, counts: Map<string, number>, order?: readonly string[], show: (k: string) => string = (k) => k, max = 40) => {
    const keys = (order ? order.filter((k) => counts.get(k)) : [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))).slice(0, max);
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

  const madeLabel = (k: string) => (k === 'any' ? 'Anything' : ADAPTATION_LABELS[k as AdaptationType] ?? k);
  const madeBadge = (x: ReadItem) => {
    const t = new Set(x.adaptations.map((a) => a.type));
    return [t.has('movie') && 'Movie', t.has('tv') && 'TV', t.has('documentary') && 'Doc'].filter(Boolean).join(' · ');
  };

  return (
    <div className="app">
      <Header
        mode="books"
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={quickAdd}
        onAddMany={() => {}}
        onHelp={() => setModal({ kind: 'help' })}
        onSettings={() => setModal({ kind: 'settings' })}
      />
      <div className="body">
        <nav className="sidebar" aria-label="Books">
          <div className="seg read-kinds" role="group" aria-label="Section">
            {READ_KINDS.map((k) => (
              <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)} title={`${READ_LABELS[k]}: ${(facets.kinds.get(k) ?? 0).toLocaleString()}`}>
                {READ_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="nav-group">
            {STATUS_FILTERS.map((s) => (
              <button type="button" key={s} className="nav-item" aria-pressed={status === s} onClick={() => setStatus(s)}>
                <span className="label">{s === 'all' ? `All ${plural}` : READ_STATUS_LABELS[s]}</span>
                <span className="count">{s === 'all' ? works.length : facets.status.get(s) ?? ''}</span>
              </button>
            ))}
          </div>
          {kind === 'magazine' && facetNav('Category', 'category', facets.categories, MAGAZINE_CATEGORIES)}
          {kind !== 'magazine' && facetNav('Made into', 'made', facets.made, ['any', 'movie', 'tv', 'documentary', 'other'], madeLabel)}
          {facetNav('Language', 'language', facets.languages)}
          {kind !== 'magazine' && facetNav('Genre', 'genre', facets.genres, undefined, (k) => k, 25)}
          <div className="nav-group media-tools">
            <button type="button" className="btn" onClick={() => void addTop()}><IconStar size={14} />Add the top {TOP_SIZE[kind]}</button>
            <button type="button" className="btn" onClick={() => setModal({ kind: 'edit', item: blankRead(kind), isNew: true })}>Add a {noun} by hand</button>
          </div>
        </nav>

        <main className="main">
          <div className="toolbar">
            <div className="search">
              <IconSearch />
              <label htmlFor="read-search" className="sr-only">Search {plural}</label>
              <input id="read-search" className="input" type="search" placeholder={`Search your ${plural}`} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="sort">
              Sort
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
              </select>
            </label>
            {anyFilter && <button type="button" className="btn btn-sm" onClick={() => setF(NO_FILTERS)}>Clear filters</button>}
            {store.canFetch && pending.length + failed.length > 0 && !store.progress && (
              <button type="button" className="btn btn-sm" onClick={() => void store.fetchDetails([...pending, ...failed].map((x) => x.id))} title={`Look up ${plural} whose details are missing`}>
                <IconRefresh size={13} />Look up {pending.length + failed.length} missing
              </button>
            )}
            <span className="result-count">{items.length.toLocaleString()} {items.length === 1 ? noun : plural}</span>
          </div>
          {store.lastError && !store.progress && failed.length > 0 && (
            <div className="note">Couldn’t look up {failed.length} {failed.length === 1 ? noun : plural}: {store.lastError}. Use “Look up {pending.length + failed.length} missing” to try again.</div>
          )}

          {store.progress && (
            <div className="banner">
              <span className="grow">Looking up covers, authors and links: {store.progress.done} of {store.progress.total}</span>
              <div className="progress"><div style={{ width: `${(100 * store.progress.done) / Math.max(1, store.progress.total)}%` }} /></div>
            </div>
          )}

          {!works.length ? (
            <div className="empty">
              <h2>Your {plural}</h2>
              <span>{TOP_HINT[kind]} {kind === 'magazine' ? 'Each with its publisher, Wikipedia article and official site.' : 'Each with its author, synopsis, Wikipedia and Goodreads pages, and the movies, TV shows and documentaries made from it.'} Or add any {noun} by name.</span>
              <div className="chips">
                <button type="button" className="btn btn-primary" onClick={() => void addTop()}><IconStar size={14} />Add the top {TOP_SIZE[kind]}</button>
                <button type="button" className="btn" onClick={() => (store.canFetch ? setModal({ kind: 'add', text: '' }) : setModal({ kind: 'edit', item: blankRead(kind), isNew: true }))}>Add a {noun}</button>
              </div>
              {!isTauri() && <span className="hint">Details are looked up in the desktop app only.</span>}
            </div>
          ) : !items.length ? (
            <div className="empty"><h2>Nothing matches</h2><span>Try another search or clear the filters.</span></div>
          ) : (
            <div className={`mgrid${density === 'compact' ? ' compact' : ''}`}>
              {items.slice(0, limit).map((x) => (
                <article className="mcard" key={x.id}>
                  <button type="button" className="mcard-open" onClick={() => setModal({ kind: 'open', id: x.id })} title={x.summary || x.title}>
                    <div className="mposter">
                      <Poster url={x.coverUrl} title={x.title} className="mposter-img" />
                      {x.rank != null && sort === 'rank' && <span className="mbadge">#{x.rank}</span>}
                      {x.adaptations.length > 0 && <span className="mhours">{madeBadge(x) || 'Adapted'}</span>}
                      {store.fetching.has(x.id) && <span className="mbadge busy">…</span>}
                      {x.status !== 'none' && <span className={`mstatus ${x.status}`}>{READ_STATUS_LABELS[x.status]}</span>}
                    </div>
                    <div className="mcard-body">
                      <b className="mcard-title">{x.title}</b>
                      {x.originalTitle && x.originalTitle !== x.title && <span className="hint ellipsis">{x.originalTitle}</span>}
                      <span className="hint ellipsis">{[kind === 'magazine' ? x.category : x.authors, x.year != null ? (x.year < 0 ? `${-x.year} BCE` : x.year) : ''].filter(Boolean).join(' · ')}</span>
                    </div>
                  </button>
                  <div className="card-actions">
                    <button type="button" aria-pressed={x.status === 'want'} title={x.status === 'want' ? 'Remove from want to read' : 'Want to read'} aria-label="Want to read" onClick={() => void store.update(x.id, { status: x.status === 'want' ? 'none' : 'want' })}><IconStar size={14} /></button>
                    <button type="button" aria-pressed={x.status === 'read'} title={x.status === 'read' ? 'Not read' : 'Mark read'} aria-label="Read" onClick={() => void store.update(x.id, { status: x.status === 'read' ? 'none' : 'read' })}><IconCheck size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {items.length > limit && <ShowMore left={items.length - limit} noun={plural} onMore={() => setLimit((l) => l + PAGE)} />}
        </main>
      </div>

      {modal?.kind === 'add' && (
        <ReadAddDialog kind={kind} initialText={modal.text} onClose={() => setModal(null)} onAdded={added} onManual={(item) => setModal({ kind: 'edit', item, isNew: true })} />
      )}
      {modal?.kind === 'edit' && (
        <ReadEditDialog
          item={modal.item}
          isNew={modal.isNew}
          onClose={() => setModal(modal.isNew ? null : { kind: 'open', id: modal.item.id })}
          onSaved={(item) => setModal({ kind: 'open', id: item.id })}
        />
      )}
      {opened && <ReadDetail key={opened.id} item={opened} onClose={() => setModal(null)} onEdit={() => setModal({ kind: 'edit', item: opened, isNew: false })} />}
      {modal?.kind === 'settings' && (
        <SettingsDialog
          onClose={() => setModal(null)}
          theme={shell.themePref}
          setTheme={setThemePref}
          density={density}
          setDensity={setDensity}
          data={{
            label: 'Import and export books, comics and magazines',
            hint: 'A JSON file with everything in the Books tab: details, links, status and your notes.',
            onImport: () => { setModal(null); void importAll(); },
            onExport: () => { setModal(null); void exportAll(); },
          }}
        />
      )}
      {modal?.kind === 'help' && <ShortcutsDialog onClose={() => setModal(null)} />}
    </div>
  );
}
