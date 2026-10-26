import { useEffect, useState } from 'react';
import { parseLinkImportFile, type ParsedLinkImport } from '../lib/link-backup';
import { browserBookmarkFiles, pickTextFile, readTextFile, type BrowserBookmarkFile } from '../lib/platform';
import { isTauri } from '../lib/storage';
import { errorText, useLinks, useLinkStore, useStore, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconUpload } from './Icons';

interface Props {
  onClose: () => void;
  /** Called after an import with how many links and YouTube bookmarks were added. */
  onImported: (links: number, youtube: number) => void;
}

/** Brings in links from a browser's bookmarks, a TubeMarks backup, a CSV or any text with links. */
export function LinkImportDialog({ onClose, onImported }: Props) {
  const store = useLinkStore();
  const ytStore = useStore();
  const lib = useLinks();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; parsed: ParsedLinkImport } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [reapply, setReapply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [browsers, setBrowsers] = useState<BrowserBookmarkFile[]>([]);

  useEffect(() => {
    browserBookmarkFiles().then(setBrowsers, () => setBrowsers([]));
  }, []);

  const load = (name: string, text: string) => setFile({ name, parsed: parseLinkImportFile(name, text) });

  const choose = async () => {
    setError('');
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      if ('rows' in picked) throw new Error('That’s an old YouTube Organizer file. Import it from the YouTube library instead.');
      load(picked.name, picked.text);
    } catch (e) {
      setFile(null);
      setError(`Couldn’t read that file: ${errorText(e)}`);
    }
  };

  const fromBrowser = async (b: BrowserBookmarkFile) => {
    setError('');
    try {
      // The browser keeps its bookmarks in a JSON file called "Bookmarks"; it is only read.
      setFile({ name: `${b.browser} (${b.profile})`, parsed: parseLinkImportFile('Bookmarks', await readTextFile(b.path)) });
    } catch (e) {
      setFile(null);
      setError(`Couldn’t read ${b.browser}’s bookmarks: ${errorText(e)}`);
    }
  };

  const preview = file ? store.previewImport(file.parsed.items, mode) : null;
  const ytPreview = file ? ytStore.previewImport(file.parsed.youtube, 'merge') : null;

  const doImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await store.importItems(file.parsed.items, mode, { reapplyFolders: mode === 'merge' && reapply && file.parsed.hasFolders });
      const yr = file.parsed.youtube.length ? await ytStore.importItems(file.parsed.youtube, 'merge') : { added: 0, duplicates: 0 };
      const parts = [`Imported ${r.added.toLocaleString()} link${r.added === 1 ? '' : 's'}`];
      if (yr.added) parts.push(`${yr.added.toLocaleString()} YouTube bookmark${yr.added === 1 ? '' : 's'}`);
      const skipped = r.duplicates + yr.duplicates + file.parsed.repeated;
      if (r.updated) parts.push(`moved ${r.updated.toLocaleString()} saved link${r.updated === 1 ? '' : 's'} into their folders`);
      toast({ text: `${parts.join(', ')}${skipped ? `. Skipped ${skipped.toLocaleString()} duplicates` : ''}.` }, 10000);
      onImported(r.added, yr.added);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const canReapply = mode === 'merge' && !!file?.parsed.hasFolders && (preview?.duplicates ?? 0) > 0;
  const total = (preview?.added ?? 0) + (ytPreview?.added ?? 0) + (canReapply && reapply ? preview!.duplicates : 0);

  return (
    <Dialog
      title="Import links"
      onClose={onClose}
      footer={
        <>
          {error && <span className="error">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{file ? 'Cancel' : 'Close'}</button>
          {file && (
            <button type="button" className="btn btn-primary" disabled={busy || !total} onClick={doImport}>
              {busy ? 'Importing…' : canReapply && reapply && !(preview?.added || ytPreview?.added) ? 'Update folders' : `Import ${((preview?.added ?? 0) + (ytPreview?.added ?? 0)).toLocaleString()}`}
            </button>
          )}
        </>
      }
    >
      <div className="dialog-body" style={{ gap: 16 }}>
        {isTauri() && browsers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>From a browser on this computer</h3>
            {browsers.map((b) => (
              <button type="button" className="option-btn" key={b.path} onClick={() => void fromBrowser(b)}>
                <IconUpload size={18} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{b.browser} · {b.profile}</span>
                  <span className="hint">Each folder becomes a category, named by its path (for example “AI / Coding”). The browser’s bookmarks are only read, never changed.</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="dropzone">
          <IconUpload size={22} />
          <span style={{ fontWeight: 500 }}>A browser’s exported bookmarks (.html), a TubeMarks links backup (.json), a .csv with a “url” column, or any .txt with links</span>
          <button type="button" className="btn btn-sm" onClick={choose}>Choose file</button>
        </div>
        {file && preview && ytPreview && (
          <div className="note" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
            <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</span>
            <div className="stat-grid four">
              <div className="stat"><b>{preview.added.toLocaleString()}</b><span className="hint">New links</span></div>
              <div className="stat"><b>{ytPreview.added.toLocaleString()}</b><span className="hint">New YouTube (to the YouTube library)</span></div>
              <div className="stat"><b>{(preview.duplicates + ytPreview.duplicates + file.parsed.repeated).toLocaleString()}</b><span className="hint">Duplicates (skipped)</span></div>
              <div className="stat"><b>{file.parsed.invalid.toLocaleString()}</b><span className="hint">Not web links</span></div>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <legend className="hint" style={{ padding: 0, marginBottom: 6 }}>How to import</legend>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="link-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge with my links
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="link-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace my links
              </label>
            </fieldset>
            {canReapply && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <input type="checkbox" checked={reapply} onChange={(e) => setReapply(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  Also put the {preview!.duplicates.toLocaleString()} links I already have into their folders’ categories
                  <span className="hint" style={{ display: 'block' }}>Tags an earlier import made from subfolders are removed. Your own tags, flags and notes stay.</span>
                </span>
              </label>
            )}
            {mode === 'replace' && lib.links.length > 0 && (
              <span className="error">This deletes your current {lib.links.length.toLocaleString()} links first. Export a backup before you continue. YouTube bookmarks are only ever added.</span>
            )}
            <span className="hint">Titles from the file are kept. Descriptions, pictures and icons are then read from each page in the background.</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
