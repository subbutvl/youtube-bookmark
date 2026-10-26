import { useMemo, useState, type FormEvent } from 'react';
import { MODES, PLACEHOLDER_MODES, useLibrary, useLinks, useRss, type Mode } from '../state';
import { IconBookmark, IconDownload, IconMoon, IconPlus, IconSettings, IconSun, IconUpload } from './Icons';
import { WindowControls } from './WindowControls';

interface Props {
  mode: Mode;
  setMode: (m: Mode) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  /** Adds what was typed; resolves true when the box should be cleared. */
  onQuickAdd: (text: string) => Promise<boolean>;
  onAddMany: (text: string) => void;
  onImport?: () => void;
  onExport?: () => void;
  onHelp: () => void;
  onSettings?: () => void;
}

const PLACEHOLDERS: Partial<Record<Mode, string>> = {
  youtube: 'Paste a YouTube link and press Enter. Other links go to their own tab',
  links: 'Paste any link and press Enter. YouTube, Git and Wikipedia links go to their own tabs',
  git: 'Paste a GitHub, GitLab or other repository link and press Enter',
  wiki: 'Paste a Wikipedia link and press Enter',
  rss: 'Paste a feed or a site’s address to subscribe, and press Enter',
};

/** The title bar shared by both libraries: mode switch, add box, import/export, help, settings and window buttons. */
export function Header({ mode, setMode, theme, toggleTheme, onQuickAdd, onAddMany, onImport, onExport, onHelp, onSettings }: Props) {
  const [text, setText] = useState('');
  const bookmarks = useLibrary().bookmarks.length;
  const links = useLinks().links;
  const items = useRss().items;
  const counts = useMemo(() => {
    const n: Partial<Record<Mode, number>> = { youtube: bookmarks, links: 0, git: 0, wiki: 0 };
    for (const l of links) n[l.section] = (n[l.section] ?? 0) + 1;
    const unread = items.reduce((k, i) => k + (i.read ? 0 : 1), 0);
    if (unread) n.rss = unread;
    return n;
  }, [bookmarks, links, items]);
  const canAdd = !(PLACEHOLDER_MODES as Mode[]).includes(mode);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t && (await onQuickAdd(t))) setText('');
  };
  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region title="TubeMarks">
        <div className="brand-mark"><IconBookmark size={16} strokeWidth={2.4} /></div>
      </div>
      <div className="mode-switch" role="group" aria-label="Library">
        {MODES.map((m, i) => (
          <button type="button" key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)} title={`${m.label}${m.id === 'rss' && counts.rss ? `: ${counts.rss} unread` : ''} (Ctrl+${i + 1})`}>
            {m.label}
            {counts[m.id] != null && <span className="count">{counts[m.id]!.toLocaleString()}</span>}
          </button>
        ))}
      </div>
      <form className="addform" onSubmit={submit}>
        <label htmlFor="quick-add" className="sr-only">Add a link</label>
        <input
          id="quick-add"
          className="input"
          style={{ flex: 1, background: 'var(--bg)' }}
          placeholder={PLACEHOLDERS[mode] ?? 'Nothing to add here yet'}
          disabled={!canAdd}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!canAdd}><IconPlus /><span className="btn-label">Add</span></button>
        <button type="button" className="btn" disabled={!canAdd || mode === 'rss'} onClick={() => { onAddMany(text.trim()); setText(''); }} title="Add several links at once (Ctrl+Shift+N)">Add many</button>
      </form>
      <div className="topbar-actions" data-tauri-drag-region>
        <button type="button" className="btn" onClick={onImport} disabled={!onImport} title="Import (Ctrl+I)"><IconUpload /><span className="btn-label">Import</span></button>
        <button type="button" className="btn" onClick={onExport} disabled={!onExport} title="Export (Ctrl+E)"><IconDownload /><span className="btn-label">Export</span></button>
        <button
          type="button"
          className="icon-btn"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
        <button type="button" className="icon-btn" aria-label="Help and keyboard shortcuts" title="Help and shortcuts (?)" onClick={onHelp}>?</button>
        <button type="button" className="icon-btn" aria-label="Settings" title="Settings (Ctrl+,)" onClick={onSettings} disabled={!onSettings}><IconSettings size={18} /></button>
      </div>
      <WindowControls />
    </header>
  );
}
