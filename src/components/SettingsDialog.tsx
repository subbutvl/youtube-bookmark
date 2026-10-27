import { useState } from 'react';
import { isTauri } from '../lib/storage';
import { errorText, MINIMIZE_TO_TRAY_PREF, useLibrary, usePref, useStore, type Density, type ThemePref } from '../state';
import { Dialog } from './Dialog';
import { IconDownload, IconUpload } from './Icons';

interface Props {
  onClose: () => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  density: Density;
  setDensity: (d: Density) => void;
  /** The current library's "fetch missing details" row. */
  details?: { label: string; noun: string; missing: number; canFetch: boolean; fetch: () => void };
  /** Import and export for the current tab; each closes Settings and opens its own dialog. */
  data?: { label: string; hint: string; onImport: () => void; onExport: () => void };
}

export function SettingsDialog({ onClose, theme, setTheme, density, setDensity, details, data }: Props) {
  const store = useStore();
  useLibrary(); // re-render when the key or library changes
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toTray, setToTray] = usePref<'on' | 'off'>(MINIMIZE_TO_TRAY_PREF, 'on');

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (key.trim()) await store.verifyApiKey(key);
      await store.setApiKey(key);
      setKey('');
      setStatus({ ok: true, text: key.trim() ? 'Key saved and working.' : 'Key removed from Settings.' });
    } catch (e) {
      setStatus({ ok: false, text: `YouTube rejected that key: ${errorText(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const source = store.apiKeySource;

  return (
    <Dialog title="Settings" onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>Done</button>}>
      <div className="dialog-body" style={{ gap: 20 }}>
        {data && (
          <div className="field">
            <span>{data.label}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={data.onImport} title="Ctrl+I"><IconUpload />Import</button>
              <button type="button" className="btn" onClick={data.onExport} title="Ctrl+E"><IconDownload />Export</button>
              <span className="hint">{data.hint}</span>
            </div>
          </div>
        )}
        <div className="field">
          <span>Appearance</span>
          <div className="seg" role="group" aria-label="Theme">
            {(['light', 'dark', 'system'] as ThemePref[]).map((t) => (
              <button type="button" key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Card size</span>
          <div className="seg" role="group" aria-label="Card size">
            <button type="button" aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')}>Comfortable</button>
            <button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</button>
          </div>
        </div>
        {isTauri() && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <input type="checkbox" checked={toTray === 'on'} onChange={(e) => setToTray(e.target.checked ? 'on' : 'off')} style={{ width: 18, height: 18 }} />
            Minimize to the system tray
            <span className="hint" style={{ fontWeight: 400 }}>Click the tray icon to bring TubeMarks back.</span>
          </label>
        )}
        <div className="field">
          <label htmlFor="api-key">YouTube Data API v3 key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="api-key"
              className="input"
              style={{ flex: 1 }}
              type="password"
              autoComplete="off"
              placeholder={source === 'none' ? 'Paste your key' : 'Paste a new key to replace the current one'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{key.trim() ? 'Check and save' : source === 'settings' ? 'Remove' : 'Save'}</button>
          </div>
          <span className="hint">
            {source === 'settings' && 'Using the key saved in Settings on this computer. Remove it to go back to the default key.'}
            {source === 'env' && 'Using the default key. Paste a key here to use your own instead.'}
            {source === 'none' && 'No key yet. Without one, bookmarks show only their thumbnail and link.'}
            {' '}Keys stay on this computer and never go into exports.
          </span>
          {status && <span className={status.ok ? 'ok' : 'error'} style={{ fontSize: 13 }}>{status.text}</span>}
        </div>
        {details && (
        <div className="field">
          <span>{details.label}</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="hint" style={{ flex: 1 }}>
              {details.missing ? `${details.missing} ${details.noun}${details.missing === 1 ? '' : 's'} still need a title, picture or tags.` : `All ${details.noun}s have their details.`}
            </span>
            <button type="button" className="btn btn-sm" disabled={!details.missing || !details.canFetch} onClick={() => { details.fetch(); onClose(); }}>Fetch now</button>
          </div>
        </div>
        )}
      </div>
    </Dialog>
  );
}
