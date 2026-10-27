import { useMemo, useState } from 'react';
import type { LinkAddResult } from '../lib/link-store';
import { parseLink } from '../lib/link-url';
import { linkTitle } from '../lib/link-view';
import { parseYouTubeUrl, splitUrls } from '../lib/youtube-url';
import { errorText, useLinks, useLinkStore, useStore, useToast } from '../state';
import { Dialog, TagInput } from './Dialog';
import { SiteIcon } from './LinkCard';

interface Props {
  initialText?: string;
  onClose: () => void;
  onDone: (r: LinkAddResult) => void;
  onShowExisting: (id: string) => void;
}

type Row =
  | { kind: 'new'; input: string; domain: string }
  | { kind: 'dup'; input: string; domain: string; title: string; existingId: string }
  | { kind: 'youtube'; input: string }
  | { kind: 'repeat'; input: string }
  | { kind: 'invalid'; input: string };

/** Paste many links at once; duplicates are flagged before anything is saved. */
export function LinkAddDialog({ initialText = '', onClose, onDone, onShowExisting }: Props) {
  const store = useLinkStore();
  const ytStore = useStore();
  const lib = useLinks();
  const toast = useToast();
  const [text, setText] = useState(initialText);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>();
    return splitUrls(text).map((input): Row => {
      if (parseYouTubeUrl(input)) return { kind: 'youtube', input };
      const p = parseLink(input);
      if (!p) return { kind: 'invalid', input };
      if (seen.has(p.dedupeKey)) return { kind: 'repeat', input };
      seen.add(p.dedupeKey);
      const existing = store.findByKey(p.dedupeKey);
      if (existing) return { kind: 'dup', input, domain: p.domain, title: linkTitle(existing), existingId: existing.id };
      return { kind: 'new', input, domain: p.domain };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, store, lib]);

  const fresh = rows.filter((r) => r.kind === 'new').length;
  const youtube = rows.filter((r) => r.kind === 'youtube').map((r) => r.input);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (youtube.length) {
        const yr = await ytStore.addUrls(youtube.join('\n'), { tagNames: tags });
        if (yr.added.length) toast({ text: `Saved ${yr.added.length} YouTube link${yr.added.length === 1 ? '' : 's'} to the YouTube library.` });
      }
      const r = await store.addUrls(rows.filter((x) => x.kind === 'new').map((x) => x.input), { categoryId: categoryId || null, tagNames: tags });
      onDone(r);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const status: Record<Row['kind'], string> = { new: 'New', dup: 'Skipped', youtube: 'To YouTube', repeat: 'Skipped', invalid: 'Invalid' };
  const total = fresh + youtube.length;

  return (
    <Dialog
      title="Add links"
      onClose={onClose}
      footer={
        <>
          {error && <span className="error">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!total || busy} onClick={submit}>
            {total ? `Add ${total} link${total === 1 ? '' : 's'}` : 'Add'}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <label className="field">
          Paste one or more links, one per line
          <textarea className="textarea" rows={5} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com/article&#10;github.com/owner/repo" />
        </label>
        {rows.length > 0 && (
          <>
            <div style={{ fontWeight: 600 }}>Detected</div>
            <div className="list scroll-list" style={{ maxHeight: 260 }}>
              {rows.map((r, i) => (
                <div className="list-row" key={i}>
                  {'domain' in r ? <SiteIcon link={{ domain: r.domain, faviconUrl: '' }} size={18} /> : <span style={{ width: 18 }} />}
                  <div className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.kind === 'dup' ? r.title : r.input}</span>
                    {r.kind === 'dup' && (
                      <span className="hint">
                        Already saved, won’t be added again ·{' '}
                        <button type="button" className="btn-link" style={{ padding: 0 }} onClick={() => onShowExisting(r.existingId)}>Show it</button>
                      </span>
                    )}
                    {r.kind === 'repeat' && <span className="hint">Same link appears earlier in this list</span>}
                    {r.kind === 'youtube' && <span className="hint">A YouTube link, so it goes to the YouTube library</span>}
                    {r.kind === 'invalid' && <span className="hint">Not a web link</span>}
                  </div>
                  <span className={r.kind === 'new' || r.kind === 'youtube' ? 'ok' : 'warn'} style={{ fontSize: 12, fontWeight: 600, width: 76, textAlign: 'right' }}>{status[r.kind]}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="two-col">
          <label className="field">
            Category for all (optional)
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {[...lib.categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="field">
            <label htmlFor="add-link-tags">Tags for all (optional)</label>
            <TagInput id="add-link-tags" value={tags} onChange={setTags} suggestions={lib.tags.map((t) => t.name)} />
          </div>
        </div>
        <span className="hint">Titles, descriptions, pictures and icons are read from each page after saving.</span>
      </div>
    </Dialog>
  );
}
