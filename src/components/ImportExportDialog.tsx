import { useState } from 'react';
import { exportCsv, exportJson, exportTxt, parseImportFile, parseLegacyItems, type ExportFormat, type ParsedImport } from '../lib/backup';
import { pickLegacyDatabase, pickTextFile, saveTextFile } from '../lib/platform';
import { isTauri } from '../lib/storage';
import { errorText, useLibrary, useStore, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconDownload, IconUpload } from './Icons';

const FORMATS: { id: ExportFormat; name: string; desc: string; ext: string }[] = [
  { id: 'json', name: 'Full backup (.ytbm.json)', desc: 'Bookmarks, categories and tags. Restores everything.', ext: 'json' },
  { id: 'csv', name: 'Spreadsheet (.csv)', desc: 'One row per bookmark; tags separated by semicolons.', ext: 'csv' },
  { id: 'txt', name: 'Links only (.txt)', desc: 'One URL per line, for sharing or another app.', ext: 'txt' },
];

export function ImportExportDialog({ onClose, onImported }: { onClose: () => void; onImported: (added: number) => void }) {
  const store = useStore();
  const lib = useLibrary();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; parsed: ParsedImport } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doExport = async (f: (typeof FORMATS)[number]) => {
    setError('');
    const text = f.id === 'json' ? exportJson(lib) : f.id === 'csv' ? exportCsv(lib) : exportTxt(lib);
    const date = new Date().toISOString().slice(0, 10);
    const name = f.id === 'json' ? `tubemarks-${date}.ytbm.json` : `tubemarks-${date}.${f.ext}`;
    try {
      if (await saveTextFile(name, text, f.ext)) toast({ text: `Exported ${lib.bookmarks.length} bookmarks.` });
    } catch (e) {
      setError(errorText(e));
    }
  };

  const choose = async () => {
    setError('');
    try {
      const picked = await pickTextFile();
      if (picked) setFile({ name: picked.name, parsed: parseImportFile(picked.name, picked.text) });
    } catch (e) {
      setFile(null);
      setError(`Couldn’t read that file: ${errorText(e)}`);
    }
  };

  const chooseLegacy = async () => {
    setError('');
    try {
      const picked = await pickLegacyDatabase();
      if (picked) setFile({ name: picked.name, parsed: parseLegacyItems(picked.rows) });
    } catch (e) {
      setFile(null);
      setError(errorText(e));
    }
  };

  const preview = file ? store.previewImport(file.parsed.items, mode) : null;

  const doImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await store.importItems(file.parsed.items, mode);
      toast({ text: `Imported ${r.added} bookmark${r.added === 1 ? '' : 's'}${r.duplicates ? `, skipped ${r.duplicates} already in your library` : ''}.` });
      onImported(r.added);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Import and export"
      onClose={onClose}
      footer={
        <>
          {error && <span className="error">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{file ? 'Cancel' : 'Close'}</button>
          {file && (
            <button type="button" className="btn btn-primary" disabled={busy || !preview?.added} onClick={doImport}>
              Import {preview?.added ?? 0} bookmark{preview?.added === 1 ? '' : 's'}
            </button>
          )}
        </>
      }
    >
      <div className="dialog-body" style={{ gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Export</h3>
          {FORMATS.map((f) => (
            <button type="button" className="option-btn" key={f.id} onClick={() => doExport(f)} disabled={!lib.bookmarks.length}>
              <IconDownload size={18} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{f.name}</span>
                <span className="hint">{f.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Import</h3>
          <div className="dropzone">
            <IconUpload size={22} />
            <span style={{ fontWeight: 500 }}>A .ytbm.json backup, a .csv with a “url” column, or any .txt / .html file with YouTube links</span>
            <button type="button" className="btn btn-sm" onClick={choose}>Choose file</button>
          </div>
          {isTauri() && (
            <button type="button" className="option-btn" onClick={chooseLegacy}>
              <IconUpload size={18} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600 }}>From the old YouTube Organizer app (.sqlite)</span>
                <span className="hint">Brings in each link, its type, watched flag and date added. Titles, categories and tags are then fetched from YouTube. The old file is only read, never changed.</span>
              </span>
            </button>
          )}
          {file && preview && (
            <div className="note" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
              <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</span>
              <div className="stat-grid">
                <div className="stat"><b>{preview.added}</b><span className="hint">New</span></div>
                <div className="stat"><b>{preview.duplicates + file.parsed.repeated}</b><span className="hint">Duplicates (skipped)</span></div>
                <div className="stat"><b>{file.parsed.invalid}</b><span className="hint">Invalid</span></div>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <legend className="hint" style={{ padding: 0, marginBottom: 6 }}>How to import</legend>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge with my library
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace my library
                </label>
              </fieldset>
              {mode === 'replace' && lib.bookmarks.length > 0 && (
                <span className="error">This deletes your current {lib.bookmarks.length} bookmarks first. Export a backup before you continue.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
