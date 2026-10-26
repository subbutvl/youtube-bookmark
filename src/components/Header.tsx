import { useState, type FormEvent } from 'react';
import { useLibrary, useLinks, type Mode } from '../state';
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
  onImport: () => void;
  onExport: () => void;
  onHelp: () => void;
  onSettings: () => void;
}

const MODE_LABELS: Record<Mode, string> = { youtube: 'YouTube', links: 'Links' };

/** The title bar shared by both libraries: mode switch, add box, import/export, help, settings and window buttons. */
export function Header({ mode, setMode, theme, toggleTheme, onQuickAdd, onAddMany, onImport, onExport, onHelp, onSettings }: Props) {
  const [text, setText] = useState('');
  const counts: Record<Mode, number> = { youtube: useLibrary().bookmarks.length, links: useLinks().links.length };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t && (await onQuickAdd(t))) setText('');
  };
  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <div className="brand-mark"><IconBookmark size={16} strokeWidth={2.4} /></div>
        TubeMarks
      </div>
      <div className="mode-switch" role="group" aria-label="Library">
        {(['youtube', 'links'] as Mode[]).map((m, i) => (
          <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)} title={`${MODE_LABELS[m]} (Ctrl+${i + 1})`}>
            {MODE_LABELS[m]} <span className="count">{counts[m].toLocaleString()}</span>
          </button>
        ))}
      </div>
      <form className="addform" onSubmit={submit}>
        <label htmlFor="quick-add" className="sr-only">Add a link</label>
        <input
          id="quick-add"
          className="input"
          style={{ flex: 1, background: 'var(--bg)' }}
          placeholder={mode === 'links' ? 'Paste any link and press Enter. YouTube links go to the YouTube library' : 'Paste a YouTube link and press Enter. Other links go to Links'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary"><IconPlus />Add</button>
        <button type="button" className="btn" onClick={() => { onAddMany(text.trim()); setText(''); }} title="Add several links at once (Ctrl+Shift+N)">Add many</button>
      </form>
      <div className="topbar-actions" data-tauri-drag-region>
        <button type="button" className="btn" onClick={onImport} title="Import (Ctrl+I)"><IconUpload />Import</button>
        <button type="button" className="btn" onClick={onExport} title="Export (Ctrl+E)"><IconDownload />Export</button>
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
        <button type="button" className="icon-btn" aria-label="Settings" title="Settings (Ctrl+,)" onClick={onSettings}><IconSettings size={18} /></button>
      </div>
      <WindowControls />
    </header>
  );
}
