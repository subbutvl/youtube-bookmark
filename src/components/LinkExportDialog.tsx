import { useState } from 'react';
import { exportLinksCsv, exportLinksHtml, exportLinksJson, type LinkExportFormat } from '../lib/link-backup';
import { saveTextFile } from '../lib/platform';
import { errorText, useLinks, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconDownload } from './Icons';

const FORMATS: { id: LinkExportFormat; name: string; desc: string; ext: string; file: (date: string) => string }[] = [
  { id: 'json', name: 'Full backup (.tmlinks.json)', desc: 'Links, categories, tags, statuses and quick launch. Restores everything.', ext: 'json', file: (d) => `tubemarks-links-${d}.tmlinks.json` },
  { id: 'html', name: 'Browser bookmarks (.html)', desc: 'Opens in Chrome, Edge or Firefox’s bookmark import. One folder per category.', ext: 'html', file: (d) => `tubemarks-links-${d}.html` },
  { id: 'csv', name: 'Spreadsheet (.csv)', desc: 'One row per link; tags and flags separated by semicolons.', ext: 'csv', file: (d) => `tubemarks-links-${d}.csv` },
];

export function LinkExportDialog({ onClose }: { onClose: () => void }) {
  const lib = useLinks();
  const toast = useToast();
  const [error, setError] = useState('');

  const run = async (f: (typeof FORMATS)[number]) => {
    setError('');
    const text = f.id === 'json' ? exportLinksJson(lib) : f.id === 'html' ? exportLinksHtml(lib) : exportLinksCsv(lib);
    try {
      if (await saveTextFile(f.file(new Date().toISOString().slice(0, 10)), text, f.ext)) toast({ text: `Exported ${lib.links.length.toLocaleString()} links.` });
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Dialog title="Export links" onClose={onClose} footer={<>{error && <span className="error">{error}</span>}<span className="spacer" /><button type="button" className="btn" onClick={onClose}>Close</button></>}>
      <div className="dialog-body" style={{ gap: 10 }}>
        {FORMATS.map((f) => (
          <button type="button" className="option-btn" key={f.id} onClick={() => void run(f)} disabled={!lib.links.length}>
            <IconDownload size={18} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{f.name}</span>
              <span className="hint">{f.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
