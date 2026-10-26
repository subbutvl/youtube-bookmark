import { useCallback, useEffect, useMemo, useState } from 'react';
import { DuplicatesDialog } from './components/DuplicatesDialog';
import { Header } from './components/Header';
import { IconChevronDown, IconClose, IconEdit, IconFilter, IconGrid, IconList, IconSearch, IconUpload } from './components/Icons';
import { LinkAddDialog } from './components/LinkAddDialog';
import { LinkCard, SiteIcon } from './components/LinkCard';
import { LinkDrawer } from './components/LinkDrawer';
import { LinkEditDrawer } from './components/LinkEditDrawer';
import { LinkExportDialog } from './components/LinkExportDialog';
import { LinkImportDialog } from './components/LinkImportDialog';
import { LinkTable } from './components/LinkTable';
import { ManageDialog } from './components/ManageDialog';
import { QuickEdit, type QuickEditTarget } from './components/QuickEdit';
import { QuickLaunch } from './components/QuickLaunch';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import type { LinkAddResult } from './lib/link-store';
import { FLAG_LABELS, isNew, LINK_FLAGS, SECTION_LABELS, type Link, type LinkFlag, type LinkSection } from './lib/link-types';
import { applyLinkView, DEFAULT_LINK_VIEW, groupRows, linkKpis, linkTitle, LINK_SORT_LABELS, type LinkRow, type LinkSortKey, type LinkViewState } from './lib/link-view';
import { openExternal } from './lib/platform';
import { routeUrls } from './lib/route';
import { isTauri } from './lib/storage';
import { errorText, useLinks, useLinkStore, usePref, useStore, useToast, type Density, type Shell } from './state';

type Modal =
  | { kind: 'add'; text: string }
  | { kind: 'edit'; id: string }
  | { kind: 'open'; id: string }
  | { kind: 'manage' }
  | { kind: 'import' }
  | { kind: 'export' }
  | { kind: 'dups' }
  | { kind: 'settings' }
  | { kind: 'shortcuts' }
  | null;

// Pending page details are fetched once per launch, not every time the view is shown.
let autoFetched = false;
/** Rows drawn at a time; thousands of imported bookmarks stay quick to scroll. */
const PAGE = 240;

/** A tab of web links (Links, Git or Wikipedia): KPI cards, quick launch, cards or table, groups. */
export function LinksView({ shell, section }: { shell: Shell; section: LinkSection }) {
  const store = useLinkStore();
  const ytStore = useStore();
  const allLinks = useLinks();
  // Categories and tags are shared by the link tabs; the links are this tab's own.
  const lib = useMemo(() => ({ ...allLinks, links: allLinks.links.filter((l) => l.section === section) }), [allLinks, section]);
  const tabName = SECTION_LABELS[section];
  const toast = useToast();
  const { theme, setThemePref } = shell;
  const [density, setDensity] = usePref<Density>('density', 'comfortable');
  const [sortPref, setSortPref] = usePref<LinkSortKey>('linkSort', 'added-desc');
  const [layout, setLayout] = usePref<'cards' | 'table'>('linkLayout', 'cards');
  // Links groups by site out of the box; Git and Wikipedia wait for groups made by hand.
  const [grouped, setGrouped] = usePref<'on' | 'off'>(section === 'links' ? 'linkGroupBySite' : `linkGroupBySite.${section}`, section === 'links' ? 'on' : 'off');
  const [groupName, setGroupName] = useState('');
  const [view, setView] = useState<LinkViewState>({ ...DEFAULT_LINK_VIEW, sort: sortPref });
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [bulkTag, setBulkTag] = useState('');
  const [quickEdit, setQuickEdit] = useState<QuickEditTarget | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const patch = (p: Partial<LinkViewState>) => setView((v) => ({ ...v, ...p }));
  const items = useMemo(() => applyLinkView(lib, view), [lib, view]);
  // A site picked in the sidebar is already one group; show its links plainly.
  const rows = useMemo<LinkRow[]>(() => (view.group ? items.map((link) => ({ kind: 'link', link })) : groupRows(items, grouped === 'on' && !view.domain)), [items, grouped, view.domain, view.group]);
  useEffect(() => setLimit(PAGE), [view, grouped, layout]);
  const shownRows = rows.slice(0, limit);
  const kpis = useMemo(() => linkKpis(lib.links), [lib.links]);
  const siteCount = useMemo(() => new Set(lib.links.map((l) => l.domain)).size, [lib.links]);
  const catById = useMemo(() => new Map(lib.categories.map((c) => [c.id, c])), [lib.categories]);
  const tagById = useMemo(() => new Map(lib.tags.map((t) => [t.id, t])), [lib.tags]);
  const sortedCats = useMemo(() => [...lib.categories].sort((a, b) => a.name.localeCompare(b.name)), [lib.categories]);
  const tagUse = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of lib.links) for (const t of l.tagIds) n.set(t, (n.get(t) ?? 0) + 1);
    return n;
  }, [lib.links]);
  const topTags = useMemo(
    () => [...lib.tags].sort((a, b) => (tagUse.get(b.id) ?? 0) - (tagUse.get(a.id) ?? 0) || a.name.localeCompare(b.name)).slice(0, 30),
    [lib.tags, tagUse],
  );
  const usedCats = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of lib.links) if (l.categoryId) n.set(l.categoryId, (n.get(l.categoryId) ?? 0) + 1);
    return n;
  }, [lib.links]);
  const groups = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of lib.links) if (l.groupName) n.set(l.groupName, (n.get(l.groupName) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lib.links]);
  const topSites = useMemo(() => {
    const n = new Map<string, Link[]>();
    for (const l of lib.links) {
      const list = n.get(l.domain);
      if (list) list.push(l);
      else n.set(l.domain, [l]);
    }
    return [...n.entries()].filter(([, ls]) => ls.length > 1).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 12);
  }, [lib.links]);

  // ----- page details -----
  const fetchDetails = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    if (!isTauri()) {
      toast({ text: 'Page details are read in the desktop app.' });
      return;
    }
    try {
      await store.refreshMetadata(ids);
    } catch (e) {
      toast({ text: `Couldn’t read the pages: ${errorText(e)}` }, 8000);
    }
  }, [store, toast]);

  useEffect(() => {
    if (autoFetched || !isTauri()) return;
    autoFetched = true;
    const pending = store.getSnapshot().links.filter((l) => l.metadataStatus === 'pending');
    // All link tabs share one fetch on launch.
    if (pending.length) void fetchDetails(pending.map((l) => l.id));
  }, [store, fetchDetails]);

  // ----- actions -----
  const showExisting = useCallback((id: string) => {
    setModal(null);
    setView((v) => ({ ...DEFAULT_LINK_VIEW, sort: v.sort }));
    const l = store.getSnapshot().links.find((x) => x.id === id);
    if (l && l.section !== section) {
      shell.setMode(l.section);
      return;
    }
    if (l) setExpanded((s) => new Set(s).add(l.groupName ? `g:${l.groupName}` : `d:${l.domain}`));
    setFlashId(id);
    setTimeout(() => document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1800);
  }, [store, section, shell]);

  const reportAdd = useCallback((r: LinkAddResult) => {
    setModal(null);
    const parts: string[] = [];
    const elsewhere = r.added.filter((l) => l.section !== section);
    if (r.added.length > elsewhere.length) parts.push(`Added ${r.added.length - elsewhere.length} link${r.added.length - elsewhere.length === 1 ? '' : 's'}`);
    for (const sec of new Set(elsewhere.map((l) => l.section))) {
      const n = elsewhere.filter((l) => l.section === sec).length;
      parts.push(`${n} saved to ${SECTION_LABELS[sec]}`);
    }
    if (r.duplicates.length) parts.push(`${r.duplicates.length} already saved`);
    if (r.invalid.length) parts.push(`${r.invalid.length} not a web link`);
    if (!parts.length) return;
    const firstDup = r.duplicates[0]?.existing;
    const away = elsewhere[0]?.section;
    toast({
      text: `${parts.join(', ')}.`,
      action: !r.added.length && firstDup ? { label: 'Show it', run: () => showExisting(firstDup.id) } : away ? { label: `Show ${SECTION_LABELS[away]}`, run: () => shell.setMode(away) } : undefined,
    }, 6000);
  }, [toast, showExisting, section, shell]);

  // YouTube links typed here are saved to the YouTube library, and Git or Wikipedia links to their tabs.
  const quickAdd = async (text: string): Promise<boolean> => {
    const routed = routeUrls(text);
    if (routed.youtube.length + routed.links.length > 1) {
      setModal({ kind: 'add', text });
      return true;
    }
    try {
      if (routed.youtube.length) {
        const r = await ytStore.addUrls(routed.youtube.join('\n'));
        toast({ text: r.duplicates.length ? 'That video is already in the YouTube library.' : 'Saved to the YouTube library.', action: { label: 'Show YouTube', run: () => shell.setMode('youtube') } }, 6000);
        return true;
      }
      if (!routed.links.length) {
        toast({ text: 'That isn’t a web link.' });
        return false;
      }
      reportAdd(await store.addUrls(routed.links));
      return true;
    } catch (e) {
      toast({ text: errorText(e) });
      return false;
    }
  };

  const deleteIds = useCallback(async (ids: string[]) => {
    const removed = await store.deleteLinks(ids);
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    setModal((m) => (m && 'id' in m && ids.includes(m.id) ? null : m));
    toast({ text: `Deleted ${removed.length} link${removed.length === 1 ? '' : 's'}.`, action: { label: 'Undo', run: () => void store.restoreLinks(removed) } }, 6000);
  }, [store, toast]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const selectMany = useCallback((ids: string[], on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  }, []);
  const onOpen = useCallback((l: Link) => setModal({ kind: 'open', id: l.id }), []);
  const onOpenExternal = useCallback((l: Link) => {
    void store.markOpened(l.id);
    void openExternal(l.url);
  }, [store]);
  const onEdit = useCallback((id: string) => setModal({ kind: 'edit', id }), []);
  const onDelete = useCallback((id: string) => void deleteIds([id]), [deleteIds]);
  const onToggleViewed = useCallback((l: Link) => void store.setViewed([l.id], !l.viewed), [store]);
  const onToggleFlag = useCallback((l: Link, f: LinkFlag) => void store.setFlag([l.id], f, !l.flags.includes(f)), [store]);
  const onTogglePin = useCallback((l: Link) => {
    (l.quickLaunch != null ? store.unpin(l.id) : store.pin(l.id)).catch((e) => toast({ text: errorText(e) }));
  }, [store, toast]);
  const onQuickEdit = useCallback((id: string, kind: 'category' | 'tags', el: HTMLElement) => setQuickEdit({ id, kind, anchor: el.getBoundingClientRect() }), []);
  const closeQuickEdit = useCallback(() => setQuickEdit(null), []);
  const onTagClick = useCallback((id: string) => setView((v) => ({ ...v, tagIds: v.tagIds.includes(id) ? v.tagIds : [...v.tagIds, id] })), []);
  const toggleGroup = useCallback((key: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }, []);
  const groupSelected = async (ids: string[], name: string) => {
    if (!name.trim()) return;
    await store.setGroup(ids, name);
    setExpanded((s) => new Set(s).add(`g:${name.trim()}`));
    setGroupName('');
    setSelected(new Set());
    toast({ text: `Grouped ${ids.length} link${ids.length === 1 ? '' : 's'} as “${name.trim()}”.` });
  };
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const commitRename = () => {
    if (renaming && renaming.to.trim() && renaming.to.trim() !== renaming.from) {
      const to = renaming.to.trim();
      void store.renameGroup(section, renaming.from, to).then(() => setExpanded((s) => new Set(s).add(`g:${to}`)));
    }
    setRenaming(null);
  };

  useEffect(() => {
    const ids = new Set(lib.links.map((l) => l.id));
    setSelected((s) => ([...s].every((id) => ids.has(id)) ? s : new Set([...s].filter((id) => ids.has(id)))));
  }, [lib.links]);

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
      else if (ctrl && !e.shiftKey && key === 'i') setModal({ kind: 'import' });
      else if (ctrl && !e.shiftKey && key === 'e') setModal({ kind: 'export' });
      else if (ctrl && key === ',') setModal({ kind: 'settings' });
      else if (ctrl && !e.shiftKey && key === 'm') setModal({ kind: 'manage' });
      else if (ctrl && e.shiftKey && key === 'f') setShowFilters((s) => !s);
      else if (ctrl && !e.shiftKey && key === 'd') setThemePref(theme === 'dark' ? 'light' : 'dark');
      else if (ctrl && e.shiftKey && key === 'c') setDensity(density === 'compact' ? 'comfortable' : 'compact');
      else if (ctrl && e.shiftKey && key === 't') setLayout(layout === 'table' ? 'cards' : 'table');
      else if (ctrl && e.shiftKey && key === 'g') setGrouped(grouped === 'on' ? 'off' : 'on');
      else if (modal || typing) handled = false;
      else if (ctrl && key === 'a') setSelected(new Set(items.map((l) => l.id)));
      else if (ctrl && !e.shiftKey && key === 'g' && selected.size) focus('bulk-group');
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
  }, [modal, items, selected, deleteIds, theme, setThemePref, density, setDensity, layout, setLayout, grouped, setGrouped, view.query]);

  // ----- filter chips -----
  const chips: { label: string; remove: () => void }[] = [];
  if (view.status !== 'all') chips.push({ label: view.status === 'new' ? 'New' : 'Viewed', remove: () => patch({ status: 'all' }) });
  if (view.added !== 'all') chips.push({ label: view.added === 'today' ? 'Added today' : 'Added this week', remove: () => patch({ added: 'all' }) });
  for (const f of view.flags) chips.push({ label: FLAG_LABELS[f], remove: () => patch({ flags: view.flags.filter((x) => x !== f) }) });
  if (view.domain) chips.push({ label: `Site: ${view.domain}`, remove: () => patch({ domain: null }) });
  if (view.group) chips.push({ label: `Group: ${view.group}`, remove: () => patch({ group: null }) });
  for (const id of view.categoryIds) chips.push({ label: `Category: ${id ? catById.get(id)?.name ?? '?' : 'Uncategorized'}`, remove: () => patch({ categoryIds: view.categoryIds.filter((x) => x !== id) }) });
  for (const id of view.tagIds) chips.push({ label: `Tag: #${tagById.get(id)?.name ?? '?'}`, remove: () => patch({ tagIds: view.tagIds.filter((x) => x !== id) }) });
  if (view.query.trim()) chips.push({ label: `Search: “${view.query.trim()}”`, remove: () => patch({ query: '' }) });

  /** Whether the view shows exactly this filter and nothing else. */
  const isOnly = (p: Partial<LinkViewState>) => JSON.stringify({ ...DEFAULT_LINK_VIEW, sort: view.sort, ...p }) === JSON.stringify(view);
  const only = (p: Partial<LinkViewState>) => setView(isOnly(p) ? { ...DEFAULT_LINK_VIEW, sort: view.sort } : { ...DEFAULT_LINK_VIEW, sort: view.sort, ...p });
  const toggleFlagFilter = (f: LinkFlag) => patch({ flags: view.flags.includes(f) ? view.flags.filter((x) => x !== f) : [...view.flags, f] });

  const opened = modal?.kind === 'open' ? lib.links.find((l) => l.id === modal.id) : undefined;
  const editing = modal?.kind === 'edit' ? lib.links.find((l) => l.id === modal.id) : undefined;
  const failedCount = lib.links.filter((l) => l.metadataStatus === 'failed').length;
  const selectedIds = [...selected];
  const progress = store.progress;

  const card = (l: Link) => (
    <LinkCard
      key={l.id}
      l={l}
      category={l.categoryId ? catById.get(l.categoryId) : undefined}
      tags={l.tagIds.map((t) => tagById.get(t)).filter((t): t is NonNullable<typeof t> => !!t)}
      selected={selected.has(l.id)}
      flash={flashId === l.id}
      fetching={store.isFetching(l.id)}
      onSelect={toggleSelect}
      onOpen={onOpen}
      onOpenExternal={onOpenExternal}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleViewed={onToggleViewed}
      onToggleFlag={onToggleFlag}
      onTogglePin={onTogglePin}
      onTagClick={onTagClick}
      onQuickEdit={onQuickEdit}
    />
  );

  const navItem = (label: React.ReactNode, count: number, pressed: boolean, onClick: () => void, key?: string) => (
    <button type="button" key={key} className="nav-item" aria-pressed={pressed} onClick={onClick}>
      <span className="label">{label}</span>
      <span className="count">{count.toLocaleString()}</span>
    </button>
  );

  const kpiCards: { label: string; value: string; sub: string; pressed: boolean; onClick: () => void }[] = [
    { label: `Total ${section === 'links' ? 'links' : tabName}`, value: kpis.total.toLocaleString(), sub: `${siteCount.toLocaleString()} site${siteCount === 1 ? '' : 's'}`, pressed: isOnly({}), onClick: () => setView({ ...DEFAULT_LINK_VIEW, sort: view.sort }) },
    { label: 'Added today', value: kpis.today.toLocaleString(), sub: 'since midnight', pressed: isOnly({ added: 'today' }), onClick: () => only({ added: 'today' }) },
    { label: 'This week', value: kpis.week.toLocaleString(), sub: 'last 7 days', pressed: isOnly({ added: 'week' }), onClick: () => only({ added: 'week' }) },
    { label: 'New', value: kpis.fresh.toLocaleString(), sub: 'never opened', pressed: isOnly({ status: 'new' }), onClick: () => only({ status: 'new' }) },
    { label: 'Later', value: kpis.later.toLocaleString(), sub: 'saved for later', pressed: isOnly({ flags: ['later'] }), onClick: () => only({ flags: ['later'] }) },
    { label: 'Must', value: kpis.must.toLocaleString(), sub: 'must read', pressed: isOnly({ flags: ['must'] }), onClick: () => only({ flags: ['must'] }) },
    { label: 'Viewed', value: `${kpis.viewedPct}%`, sub: `${lib.links.filter((l) => l.viewed).length.toLocaleString()} opened`, pressed: isOnly({ status: 'viewed' }), onClick: () => only({ status: 'viewed' }) },
  ];

  const groupCard = (r: Extract<LinkRow, { kind: 'group' }>) => {
    const open = expanded.has(r.key);
    const fresh = r.links.filter(isNew).length;
    const what = r.manual ? `in ${r.label}` : `from ${r.label}`;
    if (open) {
      return (
        <section key={r.key} className={`site-group open${r.manual ? ' manual' : ''}`} aria-label={`${r.links.length} links ${what}`}>
          <div className="group-head">
            <button type="button" className="group-toggle" aria-expanded onClick={() => renaming?.from !== r.label && toggleGroup(r.key)}>
              <SiteIcon link={r.links[0]} size={22} />
              {r.manual && renaming?.from === r.label ? (
                <input
                  className="input"
                  style={{ height: 30 }}
                  autoFocus
                  aria-label="Group name"
                  value={renaming.to}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenaming({ ...renaming, to: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenaming(null);
                    }
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <b>{r.label}</b>
              )}
              <span className="count">{r.links.length} links{fresh ? ` · ${fresh} new` : ''}</span>
              <span className="spacer" />
              <span className="hint">Collapse</span>
              <IconChevronDown size={16} />
            </button>
            {r.manual && (
              <>
                <button type="button" className="btn btn-sm" onClick={() => setRenaming({ from: r.label, to: r.label })}><IconEdit size={13} />Rename</button>
                <button type="button" className="btn btn-sm" onClick={() => void store.setGroup(r.links.map((l) => l.id), null)}>Ungroup</button>
              </>
            )}
          </div>
          <div className={`grid${density === 'compact' ? ' compact' : ''}`}>{r.links.map(card)}</div>
        </section>
      );
    }
    return (
      <article key={r.key} className={`card site-group-card${r.manual ? ' manual' : ''}`}>
        <button type="button" className="sg-open" aria-expanded={false} onClick={() => toggleGroup(r.key)} aria-label={`Show ${r.links.length} links ${what}`}>
          <span className="sg-head">
            <SiteIcon link={r.links[0]} size={28} />
            <span className="sg-domain">{r.label}</span>
          </span>
          <span className="badge sg-count">{r.manual ? 'Group · ' : ''}{r.links.length} links ▸</span>
          <span className="sg-list">
            {r.links.slice(0, 4).map((l) => <span key={l.id} className="sg-item">{linkTitle(l)}</span>)}
            {r.links.length > 4 && <span className="hint">and {r.links.length - 4} more</span>}
          </span>
          {fresh > 0 && <span className="lbadge new" style={{ alignSelf: 'flex-start' }}>{fresh} new</span>}
        </button>
      </article>
    );
  };

  return (
    <div className="app">
      <Header
        mode={section}
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={quickAdd}
        onAddMany={(text) => setModal({ kind: 'add', text })}
        onImport={() => setModal({ kind: 'import' })}
        onExport={() => setModal({ kind: 'export' })}
        onHelp={() => setModal({ kind: 'shortcuts' })}
        onSettings={() => setModal({ kind: 'settings' })}
      />

      <div className="body">
        <nav className="sidebar" aria-label={`${tabName} library`}>
          <div className="nav-group">
            <div className="nav-heading">Status</div>
            {navItem(section === 'links' ? 'All links' : `All ${tabName}`, lib.links.length, isOnly({}), () => setView({ ...DEFAULT_LINK_VIEW, sort: view.sort }))}
            {navItem('New', kpis.fresh, view.status === 'new', () => patch({ status: view.status === 'new' ? 'all' : 'new' }))}
            {navItem('Viewed', lib.links.filter((l) => l.viewed).length, view.status === 'viewed', () => patch({ status: view.status === 'viewed' ? 'all' : 'viewed' }))}
            {LINK_FLAGS.map((f) => navItem(FLAG_LABELS[f], lib.links.filter((l) => l.flags.includes(f)).length, view.flags.includes(f), () => toggleFlagFilter(f), f))}
          </div>
          <div className="nav-group">
            <div className="nav-heading">
              Categories
              <button type="button" className="btn-link" onClick={() => setModal({ kind: 'manage' })}>Manage</button>
            </div>
            {sortedCats.filter((c) => usedCats.has(c.id) || view.categoryIds.includes(c.id)).map((c) =>
              navItem(
                <><span className="swatch" style={{ background: c.color }} />{c.name}</>,
                usedCats.get(c.id) ?? 0,
                view.categoryIds.includes(c.id),
                () => patch({ categoryIds: view.categoryIds.includes(c.id) ? view.categoryIds.filter((x) => x !== c.id) : [...view.categoryIds, c.id] }),
                c.id,
              ),
            )}
            {navItem(
              <><span className="swatch" style={{ background: 'var(--border-strong)' }} />Uncategorized</>,
              lib.links.filter((l) => !l.categoryId).length,
              view.categoryIds.includes(''),
              () => patch({ categoryIds: view.categoryIds.includes('') ? view.categoryIds.filter((x) => x !== '') : [...view.categoryIds, ''] }),
            )}
          </div>
          {groups.length > 0 && (
            <div className="nav-group">
              <div className="nav-heading">Groups</div>
              {groups.map(([name, n]) => navItem(<><span className="swatch group-swatch" />{name}</>, n, view.group === name, () => patch({ group: view.group === name ? null : name }), `grp:${name}`))}
            </div>
          )}
          {topSites.length > 0 && (
            <div className="nav-group">
              <div className="nav-heading">Top sites</div>
              {topSites.map(([domain, ls]) =>
                navItem(<><SiteIcon link={ls[0]} size={14} />{domain}</>, ls.length, view.domain === domain, () => patch({ domain: view.domain === domain ? null : domain }), domain),
              )}
            </div>
          )}
          {topTags.length > 0 && (
            <div className="nav-group" style={{ gap: 8 }}>
              <div className="nav-heading" style={{ paddingBottom: 0 }}>
                Tags
                {lib.tags.length > topTags.length && <button type="button" className="btn-link" onClick={() => setModal({ kind: 'manage' })}>All {lib.tags.length}</button>}
              </div>
              <div className="tag-cloud">
                {topTags.map((t) => (
                  <button type="button" key={t.id} className="tag-chip" aria-pressed={view.tagIds.includes(t.id)} onClick={() => patch({ tagIds: view.tagIds.includes(t.id) ? view.tagIds.filter((x) => x !== t.id) : [...view.tagIds, t.id] })}>
                    #{t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        <main className={`main${selected.size ? ' selecting' : ''}`} onScroll={quickEdit ? closeQuickEdit : undefined}>
          <section className="kpis" aria-label="Summary">
            {kpiCards.map((k) => (
              <button type="button" key={k.label} className="kpi" aria-pressed={k.pressed} onClick={k.onClick}>
                <span className="kpi-label">{k.label}</span>
                <span className="kpi-value">{k.value}</span>
                <span className="kpi-sub">{k.sub}</span>
              </button>
            ))}
          </section>

          <QuickLaunch section={section} onOpen={onOpen} />

          <div className="toolbar">
            <div className="search">
              <IconSearch />
              <label htmlFor="search" className="sr-only">Search links</label>
              <input id="search" className="input" type="search" placeholder="Search title, site, URL, tags, notes" value={view.query} onChange={(e) => patch({ query: e.target.value })} />
            </div>
            <label className="sort">
              Sort
              <select
                className="select"
                value={view.sort}
                onChange={(e) => {
                  const s = e.target.value as LinkSortKey;
                  patch({ sort: s });
                  setSortPref(s);
                }}
              >
                {(Object.keys(LINK_SORT_LABELS) as LinkSortKey[]).map((k) => <option key={k} value={k}>{LINK_SORT_LABELS[k]}</option>)}
              </select>
            </label>
            <button type="button" className="btn" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}><IconFilter />Filters</button>
            <label className="check-label" title="Ctrl+Shift+G">
              <input type="checkbox" checked={grouped === 'on'} onChange={(e) => setGrouped(e.target.checked ? 'on' : 'off')} />
              Group by site
            </label>
            <button type="button" className="btn" onClick={() => setModal({ kind: 'dups' })}>Find duplicates</button>
            <span className="result-count">{items.length.toLocaleString()} link{items.length === 1 ? '' : 's'}</span>
            <div className="seg" role="group" aria-label="View">
              <button type="button" aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')} title="Cards (Ctrl+Shift+T)"><IconGrid size={14} /> Cards</button>
              <button type="button" aria-pressed={layout === 'table'} onClick={() => setLayout('table')} title="Table (Ctrl+Shift+T)"><IconList size={14} /> Table</button>
            </div>
          </div>

          {showFilters && (
            <div className="filter-panel">
              <div className="field" style={{ fontSize: 13 }}>
                Status
                <div className="seg" role="group" aria-label="Status filter">
                  {(['all', 'new', 'viewed'] as const).map((s) => (
                    <button type="button" key={s} aria-pressed={view.status === s} onClick={() => patch({ status: s })}>{s === 'all' ? 'All' : s === 'new' ? 'New' : 'Viewed'}</button>
                  ))}
                </div>
              </div>
              <div className="field" style={{ fontSize: 13 }}>
                Flags (all must match)
                <div className="seg" role="group" aria-label="Flag filter">
                  {LINK_FLAGS.map((f) => <button type="button" key={f} aria-pressed={view.flags.includes(f)} onClick={() => toggleFlagFilter(f)}>{FLAG_LABELS[f]}</button>)}
                </div>
              </div>
              <div className="field" style={{ fontSize: 13 }}>
                Added
                <div className="seg" role="group" aria-label="Added filter">
                  {(['all', 'today', 'week'] as const).map((a) => (
                    <button type="button" key={a} aria-pressed={view.added === a} onClick={() => patch({ added: a })}>{a === 'all' ? 'Any time' : a === 'today' ? 'Today' : 'This week'}</button>
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
            </div>
          )}

          {chips.length > 0 && (
            <div className="chips">
              {chips.map((c) => (
                <button type="button" className="chip" key={c.label} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                  {c.label}<IconClose size={14} />
                </button>
              ))}
              <button type="button" className="btn-link" onClick={() => setView({ ...DEFAULT_LINK_VIEW, sort: view.sort })}>Clear all</button>
            </div>
          )}

          {progress && (
            <div className="banner" role="status">
              <span className="grow">Reading page details… {progress.done.toLocaleString()} of {progress.total.toLocaleString()}. You can keep working.</span>
              <div className="progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}

          {lib.links.length === 0 ? (
            <div className="empty">
              <h2>No links yet</h2>
              <span>Paste any web link above, or bring in your browser’s bookmarks.</span>
              <button type="button" className="btn" onClick={() => setModal({ kind: 'import' })}><IconUpload />Import bookmarks</button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty">
              <span>No links match. Try a different search or clear the filters.</span>
              <button type="button" className="btn btn-sm" onClick={() => setView({ ...DEFAULT_LINK_VIEW, sort: view.sort })}>Clear filters</button>
            </div>
          ) : layout === 'table' ? (
            <LinkTable
              rows={shownRows}
              expanded={expanded}
              onToggleGroup={toggleGroup}
              catById={catById}
              tagById={tagById}
              selected={selected}
              flashId={flashId}
              onSelect={toggleSelect}
              onSelectMany={selectMany}
              onOpen={onOpen}
              onOpenExternal={onOpenExternal}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleViewed={onToggleViewed}
              onToggleFlag={onToggleFlag}
              onTogglePin={onTogglePin}
              onTagClick={onTagClick}
              onQuickEdit={onQuickEdit}
            />
          ) : (
            <div className={`grid${density === 'compact' ? ' compact' : ''}`}>
              {shownRows.map((r) => (r.kind === 'group' ? groupCard(r) : card(r.link)))}
            </div>
          )}
          {items.length > 0 && rows.length > limit && (
            <button type="button" className="btn" style={{ alignSelf: 'center' }} onClick={() => setLimit((n) => n + PAGE)}>
              Show more ({(rows.length - limit).toLocaleString()} {grouped === 'on' ? 'rows' : 'links'} left)
            </button>
          )}

          {selected.size > 0 && (
            <div className="selbar" role="toolbar" aria-label="Selected links">
              <strong style={{ padding: '0 6px' }}>{selected.size} selected</strong>
              <button type="button" className="btn" onClick={() => void store.setViewed(selectedIds, true)}>Mark viewed</button>
              <button type="button" className="btn" onClick={() => void store.setViewed(selectedIds, false)}>Mark not viewed</button>
              <select
                className="select"
                aria-label="Set a flag"
                value=""
                onChange={(e) => {
                  const [f, on] = e.target.value.split(':') as [LinkFlag, string];
                  if (f) void store.setFlag(selectedIds, f, on === 'on');
                }}
              >
                <option value="">Flags…</option>
                {LINK_FLAGS.map((f) => <option key={f} value={`${f}:on`}>Mark {FLAG_LABELS[f]}</option>)}
                {LINK_FLAGS.map((f) => <option key={`${f}-off`} value={`${f}:off`}>Remove {FLAG_LABELS[f]}</option>)}
              </select>
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
                <label htmlFor="bulk-link-tag" className="sr-only">Tag to add</label>
                <input id="bulk-link-tag" className="select" style={{ width: 120 }} placeholder="Add tag…" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
                <button type="submit" className="btn" disabled={!bulkTag.trim()}>Add</button>
              </form>
              <form
                style={{ display: 'flex', gap: 4 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void groupSelected(selectedIds, groupName);
                }}
              >
                <label htmlFor="bulk-group" className="sr-only">Group name</label>
                <input id="bulk-group" className="select" style={{ width: 130 }} list="group-names" placeholder="Group as…" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                <datalist id="group-names">{groups.map(([g]) => <option key={g} value={g} />)}</datalist>
                <button type="submit" className="btn" disabled={!groupName.trim()}>Group</button>
              </form>
              {lib.links.some((l) => selected.has(l.id) && l.groupName) && <button type="button" className="btn" onClick={() => void store.setGroup(selectedIds, null)}>Ungroup</button>}
              <select className="select" aria-label="Move to tab" value="" onChange={(e) => e.target.value && void store.moveToSection(selectedIds, e.target.value as LinkSection)}>
                <option value="">Move to…</option>
                {(Object.keys(SECTION_LABELS) as LinkSection[]).filter((x) => x !== section).map((x) => <option key={x} value={x}>{SECTION_LABELS[x]}</option>)}
              </select>
              <button type="button" className="btn" onClick={() => void fetchDetails(selectedIds)}>Refresh details</button>
              <button type="button" className="btn" onClick={() => void deleteIds(selectedIds)}>Delete</button>
              <button type="button" className="btn" onClick={() => setSelected(new Set(items.map((l) => l.id)))}>Select all {items.length}</button>
              <button type="button" className="btn" onClick={() => setSelected(new Set())} aria-label="Clear selection"><IconClose /></button>
            </div>
          )}
        </main>
      </div>

      {quickEdit && <QuickEdit mode="links" target={quickEdit} onClose={closeQuickEdit} />}
      {modal?.kind === 'add' && <LinkAddDialog initialText={modal.text} onClose={() => setModal(null)} onDone={reportAdd} onShowExisting={showExisting} />}
      {modal?.kind === 'edit' && editing && <LinkEditDrawer key={editing.id} link={editing} onClose={() => setModal(null)} onDelete={onDelete} />}
      {modal?.kind === 'open' && opened && <LinkDrawer key={opened.id} l={opened} onClose={() => setModal(null)} />}
      {modal?.kind === 'manage' && <ManageDialog mode="links" onClose={() => setModal(null)} />}
      {modal?.kind === 'import' && (
        <LinkImportDialog
          onClose={() => setModal(null)}
          onImported={() => {
            void fetchDetails(store.getSnapshot().links.filter((l) => l.metadataStatus === 'pending').map((l) => l.id));
            const yt = ytStore.getSnapshot().bookmarks.filter((b) => b.metadataStatus === 'pending').map((b) => b.id);
            if (yt.length && ytStore.hasApiKey) void ytStore.refreshMetadata(yt).catch(() => {});
          }}
        />
      )}
      {modal?.kind === 'export' && <LinkExportDialog onClose={() => setModal(null)} />}
      {modal?.kind === 'dups' && <DuplicatesDialog onClose={() => setModal(null)} onDelete={(ids) => void deleteIds(ids)} />}
      {modal?.kind === 'shortcuts' && <ShortcutsDialog onClose={() => setModal(null)} />}
      {modal?.kind === 'settings' && (
        <SettingsDialog
          onClose={() => setModal(null)}
          theme={shell.themePref}
          setTheme={setThemePref}
          density={density}
          setDensity={setDensity}
          details={{
            label: 'Link details',
            noun: 'link',
            missing: store.needsMetadata.length + failedCount,
            canFetch: isTauri(),
            fetch: () => void fetchDetails([...store.needsMetadata, ...lib.links.filter((l) => l.metadataStatus === 'failed')].map((l) => l.id)),
          }}
        />
      )}
    </div>
  );
}
