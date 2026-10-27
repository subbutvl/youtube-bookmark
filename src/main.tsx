import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LibraryStore } from './lib/library';
import { LinkStore } from './lib/link-store';
import { MediaStore } from './lib/media-store';
import { fetchPageMeta, fetchText, postJson } from './lib/platform';
import { RssStore } from './lib/rss-store';
import { isTauri, MemoryStorage, SqliteStorage } from './lib/storage';
import { mediaCountry, StoreProvider, ToastProvider } from './state';
import './styles.css';

const REFRESH_MS = 30 * 60_000;

async function start() {
  const root = createRoot(document.getElementById('root')!);
  try {
    // In the desktop app the library lives in SQLite; in a plain browser (npm run dev) it's a local preview.
    const storage = isTauri() ? await SqliteStorage.open() : new MemoryStorage('tubemarks-preview');
    const store = new LibraryStore(storage, undefined, import.meta.env.VITE_YOUTUBE_API_KEY ?? '');
    const linkStore = new LinkStore(storage.links, fetchPageMeta);
    const rssStore = new RssStore(storage.rss, fetchText);
    const mediaFetchers = isTauri() ? { get: async (url: string) => (await fetchText(url)).body, postJson } : null;
    const mediaStore = new MediaStore(storage.media, mediaFetchers, mediaCountry);
    // Movie and TV links pasted or imported anywhere go to the Movies and TV Shows tabs, never to Links.
    linkStore.mediaSink = (urls) => void mediaStore.addLinks(urls);
    await Promise.all([store.init(), linkStore.init(), rssStore.init(), mediaStore.init()]);
    // Feeds are read again every half hour while the app is open (and at start, if stale).
    if (isTauri()) {
      void rssStore.refreshAll(REFRESH_MS);
      setInterval(() => void rssStore.refreshAll(REFRESH_MS), 5 * 60_000);
    }
    root.render(
      <StrictMode>
        <StoreProvider store={store} linkStore={linkStore} rssStore={rssStore} mediaStore={mediaStore}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StoreProvider>
      </StrictMode>,
    );
  } catch (e) {
    root.render(
      <div className="empty">
        <h2>TubeMarks couldn’t open its library</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{e instanceof Error ? e.message : String(e)}</pre>
      </div>,
    );
  }
}

void start();
