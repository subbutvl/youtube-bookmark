import { isTauri } from './storage';
import type { LegacyItem } from './backup';

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
      filters: [{ name: 'Bookmarks', extensions: ['json', 'csv', 'txt', 'html', 'htm', ...LEGACY_EXTENSIONS] }],
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
    input.accept = '.json,.csv,.txt,.html,.htm';
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

/** Opens a YouTube page in the app's own window (desktop), or a browser tab in the preview. */
export async function openInAppWindow(url: string, title: string) {
  if (!isTauri()) return openExternal(url);
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_youtube_window', { url, title });
}
