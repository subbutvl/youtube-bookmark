import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddDialog } from './components/AddDialog';
import { BookmarkCard } from './components/BookmarkCard';
import { EditDrawer } from './components/EditDrawer';
import { IconBookmark, IconClose, IconDownload, IconFilter, IconMoon, IconPlus, IconSearch, IconSettings, IconSun } from './components/Icons';
import { ImportExportDialog } from './components/ImportExportDialog';
import { ManageDialog } from './components/ManageDialog';
import { QuickEdit, type QuickEditTarget } from './components/QuickEdit';
import { SettingsDialog } from './components/SettingsDialog';
import { Viewer } from './components/Viewer';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { WindowControls } from './components/WindowControls';
import type { AddResult } from './lib/library';
import { TYPE_PLURALS, type Bookmark, type BookmarkType } from './lib/types';
import { applyView, DEFAULT_VIEW, groupByDay, SORT_LABELS, type SortKey, type ViewState } from './lib/view';
import { splitUrls } from './lib/youtube-url';
import { errorText, useLibrary, usePref, useResolvedTheme, useStore, useToast, type Density, type ThemePref } from './state';

type Modal =
  | { kind: 'add'; text: string }
  | { kind: 'edit'; id: string }
  | { kind: 'manage' }
  | { kind: 'io' }
  | { kind: 'settings' }
  | { kind: 'shortcuts' }
  | { kind: 'view'; id: string }
  | null;

const TYPES: BookmarkType[] = ['video', 'short', 'playlist', 'channel'];

export default function App() {
  const store = useStore();
  const lib = useLibrary();
  const toast = useToast();
  const [themePref, setThemePref] = usePref<ThemePref>('theme', 'system');
  const [density, setDensity] = usePref<Density>('density', 'comfortable');
  const [sortPref, setSortPref] = usePref<SortKey>('sort', 'added-desc');
  const theme = useResolvedTheme(themePref);
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW, sort: sortPref });
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [quickUrl, setQuickUrl] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [quickEdit, setQuickEdit] = useState<QuickEditTarget | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const autoFetched = useRef(false);

  const patch = (p: Partial<ViewState>) => setView((v) => ({ ...v, ...p }));
  const { base, items } = useMemo(() => applyView(lib, view), [lib, view]);
  const catById = useMemo(() => new Map(lib.categories.map((c) => [c.id, c])), [lib.categories]);
  const tagById = useMemo(() => new Map(lib.tags.map((t) => [t.id, t])), [lib.tags]);
  const sortedCats = useMemo(() => [...lib.categories].sort((a, b) => a.name.localeCompare(b.name)), [lib.categories]);
  const tagUse = useMemo(() => {
    const n = new Map<string, number>();
    for (const b of lib.bookmarks) for (const t of b.tagIds) n.set(t, (n.get(t) ?? 0) + 1);
    return n;
  }, [lib.bookmarks]);
  const topTags = useMemo(
    () => [...lib.tags].sort((a, b) => (tagUse.get(b.id) ?? 0) - (tagUse.get(a.id) ?? 0) || a.name.localeCompare(b.name)).slice(0, 30),
    [lib.tags, tagUse],
  );

  // ----- metadata fetching -----
  const fetchMetadata = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    if (!store.hasApiKey) {
      toast({ text: 'Add your YouTube API key in Settings to fetch titles and thumbnails.', action: { label: 'Settings', run: () => setModal({ kind: 'settings' }) } });
      return;
    }
    setProgress({ done: 0, total: ids.length });
    try {
      await store.refreshMetadata(ids, (done, total) => setProgress({ done, total }));
    } catch (e) {
      toast({ text: `Couldn’t fetch details from YouTube: ${errorText(e)}` }, 8000);
    } finally {
      setProgress(null);
    }
  }, [store, toast]);

  // New imports (and the migrated library) get their details on first launch.
  useEffect(() => {
    if (autoFetched.current || !store.hasApiKey) return;
    autoFetched.current = true;
    const pending = store.getSnapshot().bookmarks.filter(
      (b) => b.metadataStatus === 'pending' || b.metadataStatus === 'partial' || (b.metadataStatus === 'ok' && !b.channelUrl && b.type !== 'channel'),
    );
    if (pending.length) void fetchMetadata(pending.map((b) => b.id));
  }, [store, fetchMetadata]);

  // ----- actions -----
  const showExisting = useCallback((id: string) => {
    setModal(null);
    setView((v) => ({ ...DEFAULT_VIEW, sort: v.sort }));
    setFlashId(id);
    setTimeout(() => {
      document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1800);
  }, []);

  const reportAdd = useCallback((r: AddResult) => {
    setModal(null);
    const parts: string[] = [];
    if (r.added.length) parts.push(`Added ${r.added.length} bookmark${r.added.length === 1 ? '' : 's'}`);
    if (r.duplicates.length) parts.push(`${r.duplicates.length} already in your library`);
    if (r.invalid.length) parts.push(`${r.invalid.length} not a YouTube link`);
    const firstDup = r.duplicates[0]?.existing;
    toast({
      text: `${parts.join(', ')}.`,
      action: !r.added.length && firstDup ? { label: 'Show it', run: () => showExisting(firstDup.id) } : undefined,
    }, 6000);
    if (r.added.length) {
      setView((v) => ({ ...v, view: v.view, type: 'all' }));
      if (!store.hasApiKey) toast({ text: 'Add a YouTube API key in Settings to fetch titles and tags.' });
    }
  }, [toast, showExisting, store]);

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickUrl.trim();
    if (!text) return;
    if (splitUrls(text).length > 1) {
      setModal({ kind: 'add', text });
      setQuickUrl('');
      return;
    }
    try {
      const r = await store.addUrls(text);
      if (r.added.length || r.duplicates.length) setQuickUrl('');
      if (r.invalid.length && !r.added.length && !r.duplicates.length) {
        toast({ text: 'That isn’t a YouTube video, Short, playlist or channel link.' });
        return;
      }
      reportAdd(r);
      if (r.playlistOffers.length) {
        const list = r.playlistOffers[0];
        toast({ text: 'This video is part of a playlist.', action: { label: 'Save playlist too', run: () => void store.addUrls(`https://www.youtube.com/playlist?list=${list}`).then(reportAdd) } }, 8000);
      }
    } catch (err) {
      toast({ text: errorText(err) });
    }
  };

  const deleteIds = useCallback(async (ids: string[]) => {
    const removed = await store.deleteBookmarks(ids);
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    setModal((m) => (m?.kind === 'edit' && ids.includes(m.id) ? null : m));
    toast({ text: `Deleted ${removed.length} bookmark${removed.length === 1 ? '' : 's'}.`, action: { label: 'Undo', run: () => void store.restoreBookmarks(removed) } }, 6000);
  }, [store, toast]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const onEdit = useCallback((id: string) => setModal({ kind: 'edit', id }), []);
  const onDelete = useCallback((id: string) => void deleteIds([id]), [deleteIds]);
  const onToggleWatched = useCallback((b: Bookmark) => void store.setWatched([b.id], !b.watched), [store]);
  // Opens the viewer drawer: videos and Shorts play, playlists list their videos, channels show their page.
  const onView = useCallback((b: Bookmark) => setModal({ kind: 'view', id: b.id }), []);
  const onQuickEdit = useCallback((id: string, kind: 'category' | 'tags', el: HTMLElement) => setQuickEdit({ id, kind, anchor: el.getBoundingClientRect() }), []);
  const closeQuickEdit = useCallback(() => setQuickEdit(null), []);
  const onTagClick = useCallback((id: string) => setView((v) => ({ ...v, tagIds: v.tagIds.includes(id) ? v.tagIds : [...v.tagIds, id] })), []);

  // Drop selections for bookmarks that no longer exist.
  useEffect(() => {
    const ids = new Set(lib.bookmarks.map((b) => b.id));
    setSelected((s) => ([...s].every((id) => ids.has(id)) ? s : new Set([...s].filter((id) => ids.has(id)))));
  }, [lib.bookmarks]);

  // ----- keyboard shortcuts (listed in ShortcutsDialog) -----
  useEffect(() => {
    const focus = (id: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    };
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      let handled = true;
      if (ctrl && !e.shiftKey && key === 'l') focus('quick-add');
      else if (ctrl && e.shiftKey && key === 'n') setModal({ kind: 'add', text: '' });
      else if (ctrl && !e.shiftKey && key === 'f') focus('search');
      else if (ctrl && !e.shiftKey && key === 'i') setModal({ kind: 'io' });
      else if (ctrl && key === ',') setModal({ kind: 'settings' });
      else if (ctrl && !e.shiftKey && key === 'm') setModal({ kind: 'manage' });
      else if (ctrl && e.shiftKey && key === 'f') setShowFilters((s) => !s);
      else if (ctrl && !e.shiftKey && key === 'h') setView((v) => ({ ...v, view: v.view === 'history' ? 'library' : 'history' }));
      else if (ctrl && !e.shiftKey && key === 'd') setThemePref(theme === 'dark' ? 'light' : 'dark');
      else if (ctrl && e.shiftKey && key === 'c') setDensity(density === 'compact' ? 'comfortable' : 'compact');
      else if (modal || typing) handled = false; // the rest are single keys: leave them to dialogs and text boxes
      else if (ctrl && key === 'a') setSelected(new Set(items.map((b) => b.id)));
      else if (e.key === 'Delete' && selected.size) void deleteIds([...selected]);
      else if (e.key === '/') focus('search');
      else if (e.key === '?') setModal({ kind: 'shortcuts' });
      else if (e.key === 'Escape' && selected.size) setSelected(new Set());
      else if (e.key === 'Escape' && view.query) setView((v) => ({ ...v, query: '' }));
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [modal, items, selected, deleteIds, theme, setThemePref, density, setDensity, view.query]);

  // ----- filter chips -----
  const chips: { label: string; remove: () => void }[] = [];
  if (view.view === 'history') chips.push({ label: 'History', remove: () => patch({ view: 'library' }) });
  if (view.type !== 'all') chips.push({ label: `Type: ${TYPE_PLURALS[view.type]}`, remove: () => patch({ type: 'all' }) });
  for (const id of view.categoryIds) chips.push({ label: `Category: ${id ? catById.get(id)?.name ?? '?' : 'Uncategorized'}`, remove: () => patch({ categoryIds: view.categoryIds.filter((x) => x !== id) }) });
  for (const id of view.tagIds) chips.push({ label: `Tag: #${tagById.get(id)?.name ?? '?'}`, remove: () => patch({ tagIds: view.tagIds.filter((x) => x !== id) }) });
  if (view.watch !== 'all') chips.push({ label: view.watch === 'watched' ? 'Watched' : 'Unwatched', remove: () => patch({ watch: 'all' }) });
  if (view.failedOnly) chips.push({ label: 'Details missing', remove: () => patch({ failedOnly: false }) });
  if (view.query.trim()) chips.push({ label: `Search: “${view.query.trim()}”`, remove: () => patch({ query: '' }) });

  const viewing = modal?.kind === 'view' ? lib.bookmarks.find((b) => b.id === modal.id) : undefined;
  const editing = modal?.kind === 'edit' ? lib.bookmarks.find((b) => b.id === modal.id) : undefined;
  const groups = view.view === 'history' ? groupByDay(items) : [{ label: '', items }];
  const watchedCount = lib.bookmarks.filter((b) => b.watched).length;
  const failedCount = lib.bookmarks.filter((b) => b.metadataStatus === 'failed').length;
  const selectedIds = [...selected];

  const renderCard = (b: Bookmark) => (
    <BookmarkCard
      key={b.id}
      b={b}
      category={b.categoryId ? catById.get(b.categoryId) : undefined}
      tags={b.tagIds.map((t) => tagById.get(t)).filter((t): t is NonNullable<typeof t> => !!t)}
      selected={selected.has(b.id)}
      flash={flashId === b.id}
      fetching={store.isFetching(b.id)}
      onSelect={toggleSelect}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleWatched={onToggleWatched}
      onTagClick={onTagClick}
      onQuickEdit={onQuickEdit}
      onView={onView}
    />
  );

  const navItem = (label: React.ReactNode, count: number, pressed: boolean, onClick: () => void, key?: string) => (
    <button type="button" key={key} className="nav-item" aria-pressed={pressed} onClick={onClick}>
      <span className="label">{label}</span>
      <span className="count">{count}</span>
    </button>
  );

  return (
    <div className="app">
      <header className="topbar" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <div className="brand-mark"><IconBookmark size={16} strokeWidth={2.4} /></div>
          TubeMarks
        </div>
        <form className="addform" onSubmit={quickAdd}>
          <label htmlFor="quick-add" className="sr-only">YouTube link</label>
          <input
            id="quick-add"
            className="input"
            style={{ flex: 1, background: 'var(--bg)' }}
            placeholder="Paste a YouTube link (video, Short, playlist or channel) and press Enter"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
          />
          <button type="submit" className="btn btn-primary"><IconPlus />Add</button>
          <button type="button" className="btn" onClick={() => setModal({ kind: 'add', text: '' })} title="Add several links at once">Add many</button>
        </form>
        <div className="topbar-actions" data-tauri-drag-region>
          <button type="button" className="btn" onClick={() => setModal({ kind: 'io' })}><IconDownload />Import / Export</button>
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <button type="button" className="icon-btn" aria-label="Settings" title="Settings" onClick={() => setModal({ kind: 'settings' })}><IconSettings size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => setModal({ kind: 'shortcuts' })}>?</button>
        </div>
        <WindowControls />
      </header>

      <div className="body">
        <nav className="sidebar" aria-label="Library">
          <div className="nav-group">
            <div className="nav-heading">Library</div>
            {navItem('All', base.length, view.type === 'all', () => patch({ type: 'all' }))}
            {TYPES.map((t) => navItem(TYPE_PLURALS[t], base.filter((b) => b.type === t).length, view.type === t, () => patch({ type: t }), t))}
          </div>
          <div className="nav-group">
            <div className="nav-heading">Status</div>
            {navItem('History', lib.bookmarks.length, view.view === 'history', () => patch({ view: view.view === 'history' ? 'library' : 'history' }))}
            {navItem('Unwatched', lib.bookmarks.length - watchedCount, view.watch === 'unwatched', () => patch({ watch: view.watch === 'unwatched' ? 'all' : 'unwatched' }))}
            {navItem('Watched', watchedCount, view.watch === 'watched', () => patch({ watch: view.watch === 'watched' ? 'all' : 'watched' }))}
          </div>
          <div className="nav-group">
            <div className="nav-heading">
              Categories
              <button type="button" className="btn-link" onClick={() => setModal({ kind: 'manage' })}>Manage</button>
            </div>
            {sortedCats.map((c) =>
              navItem(
                <><span className="swatch" style={{ background: c.color }} />{c.name}</>,
                lib.bookmarks.filter((b) => b.categoryId === c.id).length,
                view.categoryIds.includes(c.id),
                () => patch({ categoryIds: view.categoryIds.includes(c.id) ? view.categoryIds.filter((x) => x !== c.id) : [...view.categoryIds, c.id] }),
                c.id,
              ),
            )}
            {navItem(
              <><span className="swatch" style={{ background: 'var(--border-strong)' }} />Uncategorized</>,
              lib.bookmarks.filter((b) => !b.categoryId).length,
              view.categoryIds.includes(''),
              () => patch({ categoryIds: view.categoryIds.includes('') ? view.categoryIds.filter((x) => x !== '') : [...view.categoryIds, ''] }),
            )}
          </div>
          {topTags.length > 0 && (
            <div className="nav-group" style={{ gap: 8 }}>
              <div className="nav-heading" style={{ paddingBottom: 0 }}>
                Tags
                {lib.tags.length > topTags.length && <button type="button" className="btn-link" onClick={() => setModal({ kind: 'manage' })}>All {lib.tags.length}</button>}
              </div>
              <div className="tag-cloud">
                {topTags.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className="tag-chip"
                    aria-pressed={view.tagIds.includes(t.id)}
                    onClick={() => patch({ tagIds: view.tagIds.includes(t.id) ? view.tagIds.filter((x) => x !== t.id) : [...view.tagIds, t.id] })}
                  >
                    #{t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        <main className={`main${selected.size ? ' selecting' : ''}`} onScroll={quickEdit ? closeQuickEdit : undefined}>
          <div className="toolbar">
            <div className="search">
              <IconSearch />
              <label htmlFor="search" className="sr-only">Search bookmarks</label>
              <input id="search" className="input" type="search" placeholder="Search title, channel, tags, notes" value={view.query} onChange={(e) => patch({ query: e.target.value })} />
            </div>
            <label className="sort">
              Sort
              <select
                className="select"
                value={view.sort}
                disabled={view.view === 'history'}
                title={view.view === 'history' ? 'History is always newest first' : undefined}
                onChange={(e) => {
                  const s = e.target.value as SortKey;
                  patch({ sort: s });
                  setSortPref(s);
                }}
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
              </select>
            </label>
            <button type="button" className="btn" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}><IconFilter />Filters</button>
            <span className="result-count">{items.length} bookmark{items.length === 1 ? '' : 's'}</span>
          </div>

          {showFilters && (
            <div className="filter-panel">
              <div className="field" style={{ fontSize: 13 }}>
                Watched
                <div className="seg" role="group" aria-label="Watched filter">
                  {(['all', 'unwatched', 'watched'] as const).map((w) => (
                    <button type="button" key={w} aria-pressed={view.watch === w} onClick={() => patch({ watch: w })}>{w === 'all' ? 'All' : w === 'watched' ? 'Watched' : 'Unwatched'}</button>
                  ))}
                </div>
              </div>
              <div className="field" style={{ fontSize: 13 }}>
                Tags must match
                <div className="seg" role="group" aria-label="Tag match">
                  <button type="button" aria-pressed={view.tagMode === 'any'} onClick={() => patch({ tagMode: 'any' })}>Any</button>
                  <button type="button" aria-pressed={view.tagMode === 'all'} onClick={() => patch({ tagMode: 'all' })}>All</button>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={view.failedOnly} onChange={(e) => patch({ failedOnly: e.target.checked })} />
                Only bookmarks whose details couldn’t be fetched ({failedCount})
              </label>
            </div>
          )}

          {chips.length > 0 && (
            <div className="chips">
              {chips.map((c) => (
                <button type="button" className="chip" key={c.label} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                  {c.label}<IconClose size={14} />
                </button>
              ))}
              <button type="button" className="btn-link" onClick={() => setView({ ...DEFAULT_VIEW, sort: view.sort })}>Clear all</button>
            </div>
          )}

          {progress && (
            <div className="banner" role="status">
              <span className="grow">Fetching details from YouTube… {progress.done} of {progress.total}</span>
              <div className="progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}
          {!progress && failedCount > 0 && store.hasApiKey && view.failedOnly && (
            <div className="banner">
              <span className="grow">{failedCount} bookmark{failedCount === 1 ? '' : 's'} couldn’t be fetched. The video may be private or deleted.</span>
              <button type="button" className="btn btn-sm" onClick={() => void fetchMetadata(lib.bookmarks.filter((b) => b.metadataStatus === 'failed').map((b) => b.id))}>Retry</button>
            </div>
          )}

          {lib.bookmarks.length === 0 ? (
            <div className="empty">
              <h2>Your library is empty</h2>
              <span>Paste a YouTube link above, or import your bookmarks from a backup file.</span>
              <button type="button" className="btn" onClick={() => setModal({ kind: 'io' })}><IconDownload />Import bookmarks</button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty">
              <span>No bookmarks match. Try a different search or clear the filters.</span>
              <button type="button" className="btn btn-sm" onClick={() => setView({ ...DEFAULT_VIEW, sort: view.sort })}>Clear filters</button>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.label || 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {g.label && <h3 className="day-heading">{g.label}<span className="count">{g.items.length} added</span></h3>}
                <div className={`grid${density === 'compact' ? ' compact' : ''}`}>{g.items.map(renderCard)}</div>
              </section>
            ))
          )}

          {selected.size > 0 && (
            <div className="selbar" role="toolbar" aria-label="Selected bookmarks">
              <strong style={{ padding: '0 6px' }}>{selected.size} selected</strong>
              <button type="button" className="btn" onClick={() => void store.setWatched(selectedIds, true)}>Mark watched</button>
              <button type="button" className="btn" onClick={() => void store.setWatched(selectedIds, false)}>Mark unwatched</button>
              <select
                className="select"
                aria-label="Set category"
                value=""
                onChange={(e) => e.target.value && void store.setCategory(selectedIds, e.target.value === '-' ? null : e.target.value)}
              >
                <option value="">Set category…</option>
                <option value="-">Uncategorized</option>
                {sortedCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <form
                style={{ display: 'flex', gap: 4 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (bulkTag.trim()) void store.addTagToMany(selectedIds, bulkTag).then(() => setBulkTag(''));
                }}
              >
                <label htmlFor="bulk-tag" className="sr-only">Tag to add</label>
                <input id="bulk-tag" className="select" style={{ width: 120 }} placeholder="Add tag…" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
                <button type="submit" className="btn" disabled={!bulkTag.trim()}>Add</button>
              </form>
              <button type="button" className="btn" onClick={() => void fetchMetadata(selectedIds)}>Refresh details</button>
              <button type="button" className="btn" onClick={() => void deleteIds(selectedIds)}>Delete</button>
              <button type="button" className="btn" onClick={() => setSelected(new Set(items.map((b) => b.id)))}>Select all {items.length}</button>
              <button type="button" className="btn" onClick={() => setSelected(new Set())} aria-label="Clear selection"><IconClose /></button>
            </div>
          )}
        </main>
      </div>

      {quickEdit && <QuickEdit target={quickEdit} onClose={closeQuickEdit} />}
      {modal?.kind === 'add' && <AddDialog initialText={modal.text} onClose={() => setModal(null)} onDone={reportAdd} onShowExisting={showExisting} />}
      {modal?.kind === 'edit' && editing && <EditDrawer key={editing.id} bookmark={editing} onClose={() => setModal(null)} onDelete={onDelete} />}
      {modal?.kind === 'manage' && <ManageDialog onClose={() => setModal(null)} />}
      {modal?.kind === 'io' && (
        <ImportExportDialog
          onClose={() => setModal(null)}
          onImported={() => {
            if (store.hasApiKey) void fetchMetadata(store.getSnapshot().bookmarks.filter((b) => b.metadataStatus === 'pending').map((b) => b.id));
          }}
        />
      )}
      {viewing && <Viewer key={viewing.id} b={viewing} onClose={() => setModal(null)} onToggleWatched={onToggleWatched} />}
      {modal?.kind === 'shortcuts' && <ShortcutsDialog onClose={() => setModal(null)} />}
      {modal?.kind === 'settings' && (
        <SettingsDialog
          onClose={() => setModal(null)}
          theme={themePref}
          setTheme={setThemePref}
          density={density}
          setDensity={setDensity}
          onFetchMissing={() => void fetchMetadata(store.needsMetadata.map((b) => b.id))}
        />
      )}
    </div>
  );
}
