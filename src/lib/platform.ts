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

export interface PickedFile {
  name: string;
  text: string;
}

/** Asks for a file to import and returns its name and text, or null if cancelled. */
export async function pickTextFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Bookmarks', extensions: ['json', 'csv', 'txt', 'html', 'htm'] }],
    });
    if (typeof path !== 'string') return null;
    const text = await invoke<string>('read_text_file', { path });
    return { name: path.split(/[\\/]/).pop() ?? path, text };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt,.html,.htm';
    input.onchange = async () => {
      const f = input.files?.[0];
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
  const path = await open({ multiple: false, directory: false, filters: [{ name: 'YouTube Organizer database', extensions: ['sqlite', 'db', 'sqlite3'] }] });
  if (typeof path !== 'string') return null;
  const rows = await invoke<LegacyItem[]>('read_legacy_db', { path });
  return { name: path.split(/[\\/]/).pop() ?? path, rows };
}
