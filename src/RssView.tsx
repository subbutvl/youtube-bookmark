import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { IconEdit, IconExternal, IconLink, IconRefresh, IconRss, IconSearch, IconStar, IconTrash } from './components/Icons';
import { FeedCatalogDialog } from './components/FeedCatalogDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { ShowMore } from './components/ShowMore';
import { WebDrawer } from './components/WebDrawer';
import { STARTER_CATEGORIES } from './lib/feed-catalog';
import { SECTION_LABELS } from './lib/link-types';
import { openExternal, pickTextFile, saveTextFile } from './lib/platform';
import type { RssFeed, RssItem } from './lib/rss-types';
import { isTauri } from './lib/storage';
import { fold } from './lib/view';
import { errorText, useLinkStore, usePref, useRss, useRssStore, useToast, type Density, type Shell } from './state';

/** All, Starred, a feed's id, or a category as `cat:<name>` ('cat:' is Uncategorized). */
type Scope = 'all' | 'starred' | string;
const catScope = (name: string) => `cat:${name}`;

function readList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** A category dropdown that can also make a new category in place. */
function CategoryPicker({ value, categories, onChange, label }: { value: string; categories: string[]; onChange: (name: string) => void; label: string }) {
  const [adding, setAdding] = useState<string | null>(null);
  if (adding !== null) {
    const done = () => {
      if (adding.trim()) onChange(adding.trim());
      setAdding(null);
    };
    return (
      <input
        className="input cat-new"
        autoFocus
        aria-label="New category name"
        placeholder="New category"
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') done();
          if (e.key === 'Escape') {
            e.stopPropagation();
            setAdding(null);
          }
        }}
        onBlur={done}
      />
    );
  }
  return (
    <select className="select" aria-label={label} title={label} value={value} onChange={(e) => (e.target.value === '\u0000new' ? setAdding('') : onChange(e.target.value))}>
      <option value="">No category</option>
      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value={'\u0000new'}>New category…</option>
    </select>
  );
}

/** Articles drawn at a time. */
const PAGE = 150;

function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function FeedIcon({ feed, size = 16 }: { feed: RssFeed; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = hostOf(feed.siteUrl || feed.url);
  if (failed || !domain) return <span className="feed-icon" style={{ width: size, height: size }}><IconRss size={size - 4} /></span>;
  return <img className="site-icon" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

/** The RSS reader: feeds in the sidebar, their newest articles in the middle, an article opens in the drawer. */
export function RssView({ shell }: { shell: Shell }) {
  const store = useRssStore();
  const linkStore = useLinkStore();
  const lib = useRss();
  const toast = useToast();
  const { theme, setThemePref } = shell;
  const [scope, setScope] = useState<Scope>('all');
  const [show, setShow] = usePref<'unread' | 'all'>('rss-show', 'unread');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [settings, setSettings] = useState(false);
  const [density, setDensity] = usePref<Density>('density', 'comfortable');
  const [catPref, setCatPref] = usePref<string>('rss-categories', JSON.stringify(STARTER_CATEGORIES));
  const [addToPref, setAddToPref] = usePref<string>('rss-add-to', '');
  const [limit, setLimit] = useState(PAGE);
  // Articles read since the list was opened stay in an Unread list until the feed changes.
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKeep(new Set());
    setLimit(PAGE);
    setConfirmUnfollow(false);
    setRenaming(null);
  }, [scope, show]);

  const feedById = useMemo(() => new Map(lib.feeds.map((f) => [f.id, f])), [lib.feeds]);
  const unreadBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of lib.items) if (!i.read) m.set(i.feedId, (m.get(i.feedId) ?? 0) + 1);
    return m;
  }, [lib.items]);
  const totalUnread = [...unreadBy.values()].reduce((a, b) => a + b, 0);
  const starred = lib.items.filter((i) => i.starred).length;
  const category = scope.startsWith('cat:') ? scope.slice(4) : null;
  const feed = scope !== 'all' && scope !== 'starred' && category === null ? feedById.get(scope) : undefined;
  useEffect(() => {
    if (scope !== 'all' && scope !== 'starred' && category === null && !feedById.has(scope)) setScope('all');
  }, [scope, category, feedById]);

  const categories = useMemo(() => {
    const names = new Set([...readList(catPref), ...lib.feeds.map((f) => f.folder).filter(Boolean)]);
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [catPref, lib.feeds]);
  const addCategory = (name: string) => {
    if (!categories.some((c) => c.toLowerCase() === name.toLowerCase())) setCatPref(JSON.stringify([...readList(catPref), name]));
  };
  const known = (name: string) => categories.find((c) => c.toLowerCase() === name.toLowerCase()) ?? name;
  // New feeds go to the category being looked at, else the last one picked.
  const addTo = category ?? feed?.folder ?? (categories.includes(addToPref) ? addToPref : '');
  const pickAddTo = (name: string) => {
    addCategory(name);
    setAddToPref(name);
    if (category !== null) setScope(catScope(name));
  };
  const setFeedCategory = (f: RssFeed, name: string) => {
    addCategory(name);
    void store.updateFeed(f.id, { folder: known(name) }).then(() => toast({ text: name ? `${f.title} moved to ${known(name)}.` : `${f.title} has no category now.` }));
  };

  const folders = useMemo(() => {
    const m = new Map<string, RssFeed[]>();
    for (const f of [...lib.feeds].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))) {
      m.set(f.folder, [...(m.get(f.folder) ?? []), f]);
    }
    return [...m.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  }, [lib.feeds]);

  const items = useMemo(() => {
    const words = fold(deferredQuery).split(/\s+/).filter(Boolean);
    return lib.items
      .filter((i) => {
        if (scope === 'starred') {
          if (!i.starred) return false;
        } else if (category !== null) {
          if ((feedById.get(i.feedId)?.folder ?? '') !== category) return false;
        } else if (scope !== 'all' && i.feedId !== scope) return false;
        if (show === 'unread' && scope !== 'starred' && i.read && !keep.has(i.id)) return false;
        if (words.length) {
          const hay = fold(`${i.title} ${i.summary} ${i.author} ${feedById.get(i.feedId)?.title ?? ''}`);
          if (!words.every((w) => hay.includes(w))) return false;
        }
        return true;
      })
      .sort((a, b) => (b.publishedAt ?? b.fetchedAt).localeCompare(a.publishedAt ?? a.fetchedAt));
  }, [lib.items, scope, category, show, keep, deferredQuery, feedById]);

  const opened = openId ? lib.items.find((i) => i.id === openId) : undefined;

  const open = useCallback(
    (i: RssItem) => {
      if (!i.url) return;
      setKeep((k) => new Set(k).add(i.id));
      setCursor(i.id);
      setOpenId(i.id);
      void store.setRead([i.id], true);
    },
    [store],
  );

  const toggleRead = (i: RssItem) => {
    setKeep((k) => new Set(k).add(i.id));
    void store.setRead([i.id], !i.read);
  };

  const saveToLinks = async (i: RssItem) => {
    try {
      const res = await linkStore.addUrls(i.url);
      const added = res.added[0];
      if (added) {
        if (!added.title && i.title) await linkStore.updateLink(added.id, { title: i.title, description: added.description || i.summary });
        toast({ text: `Saved to ${SECTION_LABELS[added.section]}.` });
      } else if (res.duplicates[0]) toast({ text: `Already in ${SECTION_LABELS[res.duplicates[0].existing.section]}.` });
      else toast({ text: 'That article has no link to save.' });
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  const follow = async (text: string) => {
    try {
      const { feed: f, existed } = await store.follow(text, known(addTo));
      setScope(f.id);
      toast({ text: existed ? `You already follow ${f.title}.` : `Following ${f.title}${addTo ? ` in ${known(addTo)}` : ''}.` });
      return true;
    } catch (e) {
      toast({ text: errorText(e) });
      return false;
    }
  };

  const refresh = async () => {
    const n = feed ? await store.refresh(feed.id) : await store.refreshAll();
    toast({ text: n ? `${n} new article${n === 1 ? '' : 's'}.` : 'No new articles.' });
  };

  const importOpml = async () => {
    try {
      const file = await pickTextFile();
      if (!file || !('text' in file)) return;
      const { added, existing } = await store.importOpml(file.text);
      toast({ text: `Following ${added.length} new feed${added.length === 1 ? '' : 's'}${existing ? `, ${existing} already followed` : ''}. Reading them now…` });
      await Promise.all(added.map((f) => store.refresh(f.id)));
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  const exportOpml = async () => {
    if (!lib.feeds.length) return toast({ text: 'No feeds to export yet.' });
    try {
      if (await saveTextFile('tubemarks-feeds.opml', store.exportOpml(), 'opml')) toast({ text: `Exported ${lib.feeds.length} feeds.` });
    } catch (e) {
      toast({ text: errorText(e) });
    }
  };

  // Keyboard: j/k move, Enter or o opens, m read/unread, s star, r refresh.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (help || catalog || settings || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'Enter' && t?.tagName === 'BUTTON') return;
      const at = items.findIndex((i) => i.id === cursor);
      const cur = at >= 0 ? items[at] : undefined;
      const move = (d: number) => {
        const next = items[Math.min(items.length - 1, Math.max(0, at + d))];
        if (!next) return;
        setCursor(next.id);
        if (opened) open(next);
        listRef.current?.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
      };
      if (e.key === 'j') move(1);
      else if (e.key === 'k') move(at < 0 ? 1 : -1);
      else if ((e.key === 'Enter' || e.key === 'o') && cur && !opened) open(cur);
      else if (e.key === 'm' && cur) toggleRead(cur);
      else if (e.key === 's' && cur) void store.setStarred(cur.id, !cur.starred);
      else if (e.key === 'r' && !opened) void refresh();
      else if (e.key === '?') setHelp(true);
      else if (e.key === '/') document.getElementById('rss-search')?.focus();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const busy = store.refreshing.size > 0;
  const heading = scope === 'all' ? 'All feeds' : scope === 'starred' ? 'Starred' : category !== null ? category || 'Uncategorized' : feed?.title ?? '';
  const unreadIn = (folder: string) => lib.feeds.reduce((n, f) => n + (f.folder === folder ? unreadBy.get(f.id) ?? 0 : 0), 0);
  const navItem = (key: string, label: React.ReactNode, count: number, extra?: React.ReactNode) => (
    <button type="button" key={key} className="nav-item" aria-pressed={scope === key} onClick={() => setScope(key)}>
      <span className="label">{label}</span>
      {extra}
      <span className="count">{count ? count.toLocaleString() : ''}</span>
    </button>
  );

  return (
    <div className="app">
      <Header
        mode="rss"
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={follow}
        onAddMany={() => {}}
        onHelp={() => setHelp(true)}
        onSettings={() => setSettings(true)}
      />
      <div className="body">
        <nav className="sidebar" aria-label="Feeds">
          <div className="nav-group">
            {navItem('all', 'All feeds', totalUnread)}
            {navItem('starred', <><IconStar size={14} />Starred</>, starred)}
          </div>
          {folders.map(([folder, feeds]) => (
            <div className="nav-group" key={folder || '-'}>
              {navItem(catScope(folder), <b className="ellipsis">{folder || 'Uncategorized'}</b>, unreadIn(folder))}
              {feeds.map((f) =>
                navItem(
                  f.id,
                  <><FeedIcon feed={f} size={14} /><span className="ellipsis">{f.title}</span></>,
                  unreadBy.get(f.id) ?? 0,
                  f.lastError ? <span className="feed-error" title={`Last refresh failed: ${f.lastError}`}>!</span> : store.refreshing.has(f.id) ? <span className="hint">…</span> : null,
                ),
              )}
            </div>
          ))}
          {!lib.feeds.length && <div className="hint" style={{ padding: '4px 10px' }}>Paste a site or feed address in the box at the top to follow it.</div>}
          <div className="nav-group">
            <button type="button" className="btn" onClick={() => setCatalog(true)}><IconRss size={14} />Discover feeds</button>
          </div>
        </nav>

        <main className="main">
          <div className="rss-head">
            <div className="rss-title">
              {feed && <FeedIcon feed={feed} size={22} />}
              {(feed || category) && renaming !== null ? (
                <input
                  className="input"
                  autoFocus
                  aria-label={feed ? 'Feed name' : 'Category name'}
                  value={renaming}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renaming.trim()) {
                      const to = renaming.trim();
                      if (feed) void store.updateFeed(feed.id, { title: to });
                      else if (category && to !== category) {
                        setCatPref(JSON.stringify([...readList(catPref).filter((c) => c !== category), to]));
                        void store.renameCategory(category, to).then(() => setScope(catScope(to)));
                      }
                      setRenaming(null);
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenaming(null);
                    }
                  }}
                  onBlur={() => setRenaming(null)}
                />
              ) : (
                <h2>{heading}</h2>
              )}
              {feed && (feed.siteUrl || feed.url) && (
                <button type="button" className="btn-link hint" onClick={() => void openExternal(feed.siteUrl || feed.url)}>{hostOf(feed.siteUrl || feed.url)}</button>
              )}
            </div>
            {(feed || category !== null) && (
              <div className="rss-cat-row">
                {feed && (
                  <label className="field-inline">
                    Category
                    <CategoryPicker label="Feed category" value={feed.folder} categories={categories} onChange={(name) => setFeedCategory(feed, name)} />
                  </label>
                )}
                {category && (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => setRenaming(category)}><IconEdit size={13} />Rename category</button>
                    <button type="button" className="btn btn-sm" onClick={() => void store.renameCategory(category, '').then(() => { setCatPref(JSON.stringify(readList(catPref).filter((c) => c !== category))); setScope(catScope('')); toast({ text: `Removed the ${category} category; its feeds have no category now.` }); })}><IconTrash size={13} />Remove category</button>
                  </>
                )}
              </div>
            )}
            {feed?.lastError && <div className="error" role="status">The last refresh failed: {feed.lastError}</div>}
            {feed?.description && <div className="hint">{feed.description}</div>}
          </div>

          <div className="toolbar">
            <div className="search">
              <IconSearch />
              <label htmlFor="rss-search" className="sr-only">Search articles</label>
              <input id="rss-search" className="input" type="search" placeholder="Search articles" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {!feed && (
              <label className="field-inline" title="Feeds you add from the box at the top go here">
                New feeds go to
                <CategoryPicker label="Category for new feeds" value={addTo} categories={categories} onChange={pickAddTo} />
              </label>
            )}
            {scope !== 'starred' && (
              <div className="seg" role="group" aria-label="Show">
                <button type="button" aria-pressed={show === 'unread'} onClick={() => setShow('unread')}>Unread</button>
                <button type="button" aria-pressed={show === 'all'} onClick={() => setShow('all')}>All</button>
              </div>
            )}
            <button type="button" className="btn" onClick={() => void refresh()} disabled={!lib.feeds.length || busy || !isTauri()} title={isTauri() ? 'Refresh (R)' : 'Feeds are read in the desktop app'}>
              <IconRefresh size={14} />{busy ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" className="btn" onClick={() => void store.markAllRead(feed?.id)} disabled={!(feed ? unreadBy.get(feed.id) : totalUnread)}>Mark all read</button>
            {feed && (
              <>
                <button type="button" className="btn" onClick={() => setRenaming(feed.title)}><IconEdit size={14} />Rename</button>
                <button
                  type="button"
                  className={`btn${confirmUnfollow ? ' btn-danger' : ''}`}
                  onClick={() => (confirmUnfollow ? void store.unfollow(feed.id).then(() => toast({ text: `Stopped following ${feed.title}.` })) : setConfirmUnfollow(true))}
                  onBlur={() => setConfirmUnfollow(false)}
                >
                  <IconTrash size={14} />{confirmUnfollow ? 'Click again to unfollow' : 'Unfollow'}
                </button>
              </>
            )}
            <span className="result-count">{items.length.toLocaleString()} article{items.length === 1 ? '' : 's'}</span>
          </div>

          {!lib.feeds.length ? (
            <div className="empty">
              <IconRss size={36} />
              <h2>Follow sites you read</h2>
              <span>Paste a site’s address or its feed in the box at the top. New articles come in every half hour while the app is open. You can also import an OPML file from another reader.</span>
              <button type="button" className="btn btn-primary" onClick={() => setCatalog(true)}>Discover feeds by category</button>
              {!isTauri() && <span className="hint">Feeds are read in the desktop app only.</span>}
            </div>
          ) : !items.length ? (
            <div className="empty">
              <h2>{query ? 'No articles match' : scope === 'starred' ? 'Nothing starred yet' : show === 'unread' ? 'All caught up' : 'No articles yet'}</h2>
              <span>{scope === 'starred' ? 'Star an article to keep it here; starred articles are never cleared.' : show === 'unread' && !query ? 'Every article here is read.' : ''}</span>
              {show === 'unread' && !query && scope !== 'starred' && <button type="button" className="btn" onClick={() => setShow('all')}>Show all articles</button>}
            </div>
          ) : (
            <div className="rss-list" ref={listRef}>
              {items.slice(0, limit).map((i) => {
                const f = feedById.get(i.feedId);
                return (
                  <article key={i.id} data-id={i.id} className={`rss-item${i.read ? ' read' : ''}${cursor === i.id ? ' cursor' : ''}`}>
                    <button type="button" className="rss-open" onClick={() => open(i)} disabled={!i.url}>
                      <span className="rss-text">
                        <span className="rss-meta">
                          {!i.read && <span className="unread-dot" aria-label="Unread" />}
                          {f && scope !== f.id && <><FeedIcon feed={f} size={14} /><b>{f.title}</b> · </>}
                          {ago(i.publishedAt ?? i.fetchedAt)}
                          {i.author && ` · ${i.author}`}
                        </span>
                        <span className="rss-item-title">{i.title || '(untitled)'}</span>
                        {i.summary && <span className="rss-summary">{i.summary}</span>}
                      </span>
                      {i.imageUrl && <img className="rss-thumb" src={i.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                    </button>
                    <div className="rss-actions">
                      <button type="button" className="icon-btn sm" aria-pressed={i.starred} aria-label={i.starred ? 'Unstar' : 'Star'} title={i.starred ? 'Unstar (S)' : 'Star (S)'} onClick={() => void store.setStarred(i.id, !i.starred)}><IconStar size={14} fill={i.starred ? 'currentColor' : 'none'} /></button>
                      <button type="button" className="icon-btn sm" aria-label={i.read ? 'Mark unread' : 'Mark read'} title={i.read ? 'Mark unread (M)' : 'Mark read (M)'} onClick={() => toggleRead(i)}><span className={`dot-toggle${i.read ? '' : ' on'}`} /></button>
                      <button type="button" className="icon-btn sm" aria-label="Save to Links" title="Save to Links" disabled={!i.url} onClick={() => void saveToLinks(i)}><IconLink size={14} /></button>
                      <button type="button" className="icon-btn sm" aria-label="Open in browser" title="Open in browser" disabled={!i.url} onClick={() => { void openExternal(i.url); void store.setRead([i.id], true); }}><IconExternal size={14} /></button>
                    </div>
                  </article>
                );
              })}
              {items.length > limit && <ShowMore left={items.length - limit} noun="articles" onMore={() => setLimit((l) => l + PAGE)} />}
            </div>
          )}
        </main>
      </div>
      {opened && (
        <WebDrawer
          key={opened.id}
          url={opened.url}
          title={opened.title || opened.url}
          icon={feedById.get(opened.feedId) && <FeedIcon feed={feedById.get(opened.feedId)!} size={22} />}
          onClose={() => setOpenId(null)}
          extras={
            <>
              <button type="button" className="btn btn-sm" aria-pressed={opened.starred} onClick={() => void store.setStarred(opened.id, !opened.starred)}><IconStar size={14} fill={opened.starred ? 'currentColor' : 'none'} />{opened.starred ? 'Starred' : 'Star'}</button>
              <button type="button" className="btn btn-sm" onClick={() => void saveToLinks(opened)}><IconLink size={14} />Save to Links</button>
            </>
          }
        />
      )}
      {settings && (
        <SettingsDialog
          onClose={() => setSettings(false)}
          theme={shell.themePref}
          setTheme={setThemePref}
          density={density}
          setDensity={setDensity}
          data={{
            label: 'Import and export feeds',
            hint: 'OPML files, which other feed readers use too.',
            onImport: () => { setSettings(false); void importOpml(); },
            onExport: () => { setSettings(false); void exportOpml(); },
          }}
        />
      )}
      {catalog && <FeedCatalogDialog onClose={() => setCatalog(false)} onFollowed={addCategory} />}
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </div>
  );
}
