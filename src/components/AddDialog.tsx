import { useMemo, useState } from 'react';
import type { AddResult } from '../lib/library';
import { TYPE_LABELS } from '../lib/types';
import { displayTitle } from '../lib/view';
import { instantThumbnail, parseYouTubeUrl, splitUrls } from '../lib/youtube-url';
import { parseLink } from '../lib/link-url';
import { errorText, useLibrary, useLinkStore, useStore, useToast } from '../state';
import { Dialog, TagInput } from './Dialog';

interface Props {
  initialText?: string;
  onClose: () => void;
  onDone: (r: AddResult) => void;
  onShowExisting: (id: string) => void;
}

type Row =
  | { kind: 'new'; input: string; type: string; thumb: string; playlistId?: string }
  | { kind: 'dup'; input: string; type: string; thumb: string; title: string; existingId: string }
  | { kind: 'repeat'; input: string }
  | { kind: 'link'; input: string }
  | { kind: 'invalid'; input: string };

export function AddDialog({ initialText = '', onClose, onDone, onShowExisting }: Props) {
  const store = useStore();
  const linkStore = useLinkStore();
  const toast = useToast();
  const lib = useLibrary();
  const [text, setText] = useState(initialText);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [savePlaylists, setSavePlaylists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>();
    return splitUrls(text).map((input): Row => {
      const p = parseYouTubeUrl(input);
      if (!p) return parseLink(input) ? { kind: 'link', input } : { kind: 'invalid', input };
      if (seen.has(p.dedupeKey)) return { kind: 'repeat', input };
      seen.add(p.dedupeKey);
      const existing = store.findByKey(p.dedupeKey);
      const thumb = existing?.thumbnailUrl || instantThumbnail(p.type, p.youtubeId);
      if (existing) return { kind: 'dup', input, type: TYPE_LABELS[p.type], thumb, title: displayTitle(existing), existingId: existing.id };
      return { kind: 'new', input, type: TYPE_LABELS[p.type], thumb, playlistId: p.playlistId };
    });
    // lib in deps so the preview updates if the library changes underneath
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, store, lib]);

  const fresh = rows.filter((r) => r.kind === 'new').length;
  const webLinks = rows.flatMap((r) => (r.kind === 'link' ? [r.input] : []));
  const offers = rows.flatMap((r) => (r.kind === 'new' && r.playlistId && !store.findByKey(`playlist:${r.playlistId}`) ? [r.playlistId] : []));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const extra = savePlaylists ? offers.map((id) => `https://www.youtube.com/playlist?list=${id}`).join('\n') : '';
      if (webLinks.length) {
        const lr = await linkStore.addUrls(webLinks, { tagNames: tags });
        if (lr.added.length) toast({ text: `Saved ${lr.added.length} other link${lr.added.length === 1 ? '' : 's'} to Links.` });
      }
      const r = await store.addUrls(`${rows.filter((x) => x.kind !== 'link').map((x) => x.input).join('\n')}\n${extra}`, { categoryId: categoryId || null, tagNames: tags });
      onDone(r);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Add bookmarks"
      onClose={onClose}
      footer={
        <>
          {error && <span className="error">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!(fresh || webLinks.length) || busy} onClick={submit}>
            {fresh ? `Add ${fresh + (savePlaylists ? offers.length : 0)} bookmark${fresh + (savePlaylists ? offers.length : 0) === 1 ? '' : 's'}` : 'Add'}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <label className="field">
          Paste one or more YouTube links, one per line
          <textarea className="textarea" rows={5} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="https://youtu.be/…&#10;https://www.youtube.com/shorts/…&#10;https://www.youtube.com/playlist?list=…&#10;https://www.youtube.com/@channel" />
        </label>
        {rows.length > 0 && (
          <>
            <div style={{ fontWeight: 600 }}>Detected</div>
            <div className="list scroll-list" style={{ maxHeight: 260 }}>
              {rows.map((r, i) => (
                <div className="list-row" key={i}>
                  <div className="mini-thumb" style={'thumb' in r && r.thumb ? { backgroundImage: `url(${r.thumb})` } : undefined} />
                  <div className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.kind === 'dup' ? r.title : r.input}</span>
                    {r.kind === 'dup' && (
                      <span className="hint">
                        Already in your library, won’t be added again ·{' '}
                        <button type="button" className="btn-link" style={{ padding: 0 }} onClick={() => onShowExisting(r.existingId)}>Show it</button>
                      </span>
                    )}
                    {r.kind === 'repeat' && <span className="hint">Same link appears earlier in this list</span>}
                    {r.kind === 'invalid' && <span className="hint">Not a link</span>}
                    {r.kind === 'link' && <span className="hint">Not a YouTube link, so it goes to Links</span>}
                  </div>
                  {'type' in r && <span className="pill">{r.type}</span>}
                  <span className={r.kind === 'new' || r.kind === 'link' ? 'ok' : 'warn'} style={{ fontSize: 12, fontWeight: 600, width: 64, textAlign: 'right' }}>
                    {r.kind === 'new' ? 'New' : r.kind === 'link' ? 'To Links' : r.kind === 'invalid' ? 'Invalid' : 'Skipped'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {offers.length > 0 && (
          <label className="note" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={savePlaylists} onChange={(e) => setSavePlaylists(e.target.checked)} />
            {offers.length === 1 ? 'A link is part of a playlist. Save the playlist too?' : `${offers.length} links are part of playlists. Save those playlists too?`}
          </label>
        )}
        <div className="two-col">
          <label className="field">
            Category for all (optional)
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Use YouTube’s category</option>
              {lib.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="field">
            <label htmlFor="add-tags">Tags for all (optional)</label>
            <TagInput id="add-tags" value={tags} onChange={setTags} suggestions={lib.tags.map((t) => t.name)} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
