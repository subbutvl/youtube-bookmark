import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { LibraryStore } from './lib/library';
import type { LinkStore } from './lib/link-store';
import type { RssStore } from './lib/rss-store';
import type { Category, Tag } from './lib/types';

const StoreContext = createContext<LibraryStore | null>(null);
const LinkStoreContext = createContext<LinkStore | null>(null);
const RssStoreContext = createContext<RssStore | null>(null);

export function StoreProvider({ store, linkStore, rssStore, children }: { store: LibraryStore; linkStore: LinkStore; rssStore: RssStore; children: ReactNode }) {
  return (
    <StoreContext.Provider value={store}>
      <LinkStoreContext.Provider value={linkStore}>
        <RssStoreContext.Provider value={rssStore}>{children}</RssStoreContext.Provider>
      </LinkStoreContext.Provider>
    </StoreContext.Provider>
  );
}

export function useRssStore(): RssStore {
  const s = useContext(RssStoreContext);
  if (!s) throw new Error('useRssStore outside StoreProvider');
  return s;
}

export function useRss() {
  const store = useRssStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useLinkStore(): LinkStore {
  const s = useContext(LinkStoreContext);
  if (!s) throw new Error('useLinkStore outside StoreProvider');
  return s;
}

export function useLinks() {
  const store = useLinkStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useStore(): LibraryStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function useLibrary() {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export type PlaceholderMode = 'movies' | 'tv' | 'books' | 'games';
export type Mode = 'youtube' | 'links' | 'git' | 'wiki' | 'rss' | PlaceholderMode;
export const PLACEHOLDER_MODES: PlaceholderMode[] = ['movies', 'tv', 'books', 'games'];
export const MODES: { id: Mode; label: string }[] = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'links', label: 'Links' },
  { id: 'git', label: 'Git' },
  { id: 'wiki', label: 'Wikipedia' },
  { id: 'rss', label: 'RSS' },
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV Shows' },
  { id: 'books', label: 'Books' },
  { id: 'games', label: 'Games' },
];

/** What the app shell hands each library view. */
export interface Shell {
  mode: Mode;
  setMode: (m: Mode) => void;
  theme: 'light' | 'dark';
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  /** Plays a YouTube video or Short in the app-wide player. */
  play: (bookmarkId: string) => void;
}

/** What category and tag editors need from either library. */
export interface Taxonomy {
  ops: {
    addCategory(name: string, color?: string): Promise<Category>;
    updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Promise<void>;
    mergeCategory(fromId: string, toId: string): Promise<void>;
    deleteCategory(id: string): Promise<void>;
    addTag(name: string): Promise<Tag>;
    renameTag(id: string, name: string): Promise<void>;
    mergeTags(fromIds: string[], toId: string): Promise<void>;
    deleteTags(ids: string[]): Promise<void>;
    setCategory(ids: string[], categoryId: string | null): Promise<void>;
    setCategoryByName(ids: string[], name: string): Promise<Category>;
    setTags(id: string, names: string[]): Promise<void>;
  };
  items: { id: string; categoryId: string | null; tagIds: string[] }[];
  categories: Category[];
  tags: Tag[];
  /** "bookmark" or "link", for messages. */
  noun: string;
}

export function useTaxonomy(mode: Mode): Taxonomy {
  const store = useStore();
  const lib = useLibrary();
  const linkStore = useLinkStore();
  const links = useLinks();
  return mode !== 'youtube'
    ? { ops: linkStore, items: links.links, categories: links.categories, tags: links.tags, noun: 'link' }
    : { ops: store, items: lib.bookmarks, categories: lib.categories, tags: lib.tags, noun: 'bookmark' };
}

// ---------- toasts ----------

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<(t: Omit<Toast, 'id'>, ms?: number) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<Toast, 'id'>, ms = 5000) => {
    const id = next.current++;
    setToasts((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), ms);
  }, []);
  const dismiss = (id: number) => setToasts((xs) => xs.filter((x) => x.id !== id));
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------- per-device preferences ----------

export type ThemePref = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

export const MINIMIZE_TO_TRAY_PREF = 'minimizeToTray';
/** Whether the title bar's minimize button hides the window to the system tray (on unless turned off in Settings). */
export function minimizeToTrayEnabled(): boolean {
  try {
    return localStorage.getItem(`tubemarks.${MINIMIZE_TO_TRAY_PREF}`) !== 'off';
  } catch {
    return true;
  }
}

export function usePref<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(`tubemarks.${key}`) as T) || initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    try {
      localStorage.setItem(`tubemarks.${key}`, v);
    } catch {
      // Preferences are a convenience; ignore storage failures.
    }
  }, [key]);
  return [value, set];
}

export function useResolvedTheme(pref: ThemePref): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return theme;
}

/** Closes a dialog on Escape. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
