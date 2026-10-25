import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LibraryStore } from './lib/library';
import { isTauri, MemoryStorage, SqliteStorage } from './lib/storage';
import { StoreProvider, ToastProvider } from './state';
import './styles.css';

async function start() {
  const root = createRoot(document.getElementById('root')!);
  try {
    // In the desktop app the library lives in SQLite; in a plain browser (npm run dev) it's a local preview.
    const storage = isTauri() ? await SqliteStorage.open() : new MemoryStorage('tubemarks-preview');
    const store = new LibraryStore(storage, undefined, import.meta.env.VITE_YOUTUBE_API_KEY ?? '');
    await store.init();
    root.render(
      <StrictMode>
        <StoreProvider store={store}>
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
