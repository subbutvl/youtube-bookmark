import { isTauri } from './storage';
import type { LegacyItem } from './backup';
import { parsePageMeta, type PageMeta } from './page-meta';

/** Opens a link in the default web browser (never inside the app). */
export async function openExternal(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export type PickedFile = { name: string; text: string } | { name: string; rows: LegacyItem[] };

const LEGACY_EXTENSIONS = ['sqlite', 'db', 'sqlite3'];
const isLegacyDb = (name: string) => LEGACY_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase() ?? '');

/** Asks for a file to import. Text files come back as text; an old-app .sqlite comes back as its rows. Null if cancelled. */
export async function pickTextFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Bookmarks', extensions: ['json', 'csv', 'txt', 'html', 'htm', 'opml', 'xml', ...LEGACY_EXTENSIONS] }],
    });
    if (typeof path !== 'string') return null;
    const name = path.split(/[\\/]/).pop() ?? path;
    if (isLegacyDb(name)) return { name, rows: await invoke<LegacyItem[]>('read_legacy_db', { path }) };
    const text = await invoke<string>('read_text_file', { path });
    return { name, text };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt,.html,.htm,.opml,.xml';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f && isLegacyDb(f.name)) return reject(new Error('Importing from the old app works in the desktop app only.'));
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.click();
  });
}

/** Saves text to a file the user picks. Returns false if cancelled. */
export async function saveTextFile(defaultName: string, text: string, ext: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await save({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path) return false;
    await invoke('write_text_file', { path, contents: text });
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Asks for the old YouTube Organizer .sqlite file and reads its links (desktop app only). */
export async function pickLegacyDatabase(): Promise<{ name: string; rows: LegacyItem[] } | null> {
  if (!isTauri()) throw new Error('Importing from the old app works in the desktop app only.');
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { invoke } = await import('@tauri-apps/api/core');
  const path = await open({ multiple: false, directory: false, filters: [{ name: 'YouTube Organizer database', extensions: LEGACY_EXTENSIONS }] });
  if (typeof path !== 'string') return null;
  const rows = await invoke<LegacyItem[]>('read_legacy_db', { path });
  return { name: path.split(/[\\/]/).pop() ?? path, rows };
}

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shows a YouTube channel page over `rect` (desktop app only; YouTube can't be framed in a page). */
export async function showChannelView(url: string, rect: ViewRect) {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('show_channel_view', { url, ...rect });
}

export async function moveChannelView(rect: ViewRect) {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('move_channel_view', { ...rect });
}

export async function closeChannelView() {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('close_channel_view');
}

/** Back, forward or reload in the page shown by showChannelView. */
export async function webViewNav(action: 'back' | 'forward' | 'reload') {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('channel_view_nav', { action });
}

/**
 * Downloads a page and reads its title, description, image and icon. The desktop app fetches it
 * itself (pages can't be read across sites from the window); the browser preview has no way to.
 */
export async function fetchPageMeta(url: string): Promise<PageMeta & { finalUrl: string }> {
  if (!isTauri()) throw new Error('Page details are fetched in the desktop app only.');
  const { invoke } = await import('@tauri-apps/api/core');
  const page = await invoke<{ finalUrl: string; html: string }>('fetch_page', { url });
  return { ...parsePageMeta(page.html, page.finalUrl), finalUrl: page.finalUrl };
}

export interface BrowserBookmarkFile {
  browser: string;
  profile: string;
  path: string;
}

/** Chrome, Edge and Brave profiles on this computer that have bookmarks (desktop app only). */
export async function browserBookmarkFiles(): Promise<BrowserBookmarkFile[]> {
  if (!isTauri()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<BrowserBookmarkFile[]>('browser_bookmark_files');
}

export async function readTextFile(path: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('read_text_file', { path });
}

/** Downloads a feed or page as text (desktop app only; sites can't be read across origins from the window). */
export async function fetchText(url: string): Promise<{ finalUrl: string; contentType: string; body: string }> {
  if (!isTauri()) throw new Error('Feeds are read in the desktop app only.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('fetch_text', { url });
}

/** Posts JSON and returns the answer as text (desktop app only). */
export async function postJson(url: string, body: string): Promise<string> {
  if (!isTauri()) throw new Error('Movie and TV details are looked up in the desktop app only.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('post_json', { url, body });
}
