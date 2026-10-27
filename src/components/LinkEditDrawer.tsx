import { useState } from 'react';
import { FLAG_LABELS, LINK_FLAGS, type Link, type LinkFlag } from '../lib/link-types';
import { openExternal } from '../lib/platform';
import { isTauri } from '../lib/storage';
import { formatDate } from '../lib/view';
import { errorText, useLinks, useLinkStore, useToast } from '../state';
import { Dialog, TagInput } from './Dialog';
import { IconExternal, IconRefresh } from './Icons';
import { SiteIcon } from './LinkCard';

const NEW_CATEGORY = '__new__';

export function LinkEditDrawer({ link: l, onClose, onDelete }: { link: Link; onClose: () => void; onDelete: (id: string) => void }) {
  const store = useLinkStore();
  const lib = useLinks();
  const toast = useToast();
  const tagName = new Map(lib.tags.map((t) => [t.id, t.name]));
  const [url, setUrl] = useState(l.url);
  const [title, setTitle] = useState(l.title);
  const [description, setDescription] = useState(l.description);
  const [categoryId, setCategoryId] = useState(l.categoryId ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [tags, setTags] = useState(l.tagIds.map((t) => tagName.get(t) ?? '').filter(Boolean));
  const [notes, setNotes] = useState(l.notes);
  const [viewed, setViewed] = useState(l.viewed);
  const [flags, setFlags] = useState<LinkFlag[]>(l.flags);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = lib.links.find((x) => x.id === l.id) ?? l;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      let cat: string | null = categoryId || null;
      if (categoryId === NEW_CATEGORY) cat = newCategory.trim() ? (await store.addCategory(newCategory)).id : null;
      await store.updateLink(l.id, { url, title, description, categoryId: cat, notes, viewed, flags: LINK_FLAGS.filter((f) => flags.includes(f)) }, tags);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      await store.refreshMetadata([l.id], undefined, true);
      const fresh = store.getSnapshot().links.find((x) => x.id === l.id);
      if (fresh) {
        setTitle(fresh.title);
        setDescription(fresh.description);
      }
      toast({ text: fresh?.metadataStatus === 'ok' ? 'Details refreshed from the page.' : 'The page didn’t give a title. You can type one.' });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Edit link"
      variant="drawer"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-danger" onClick={() => onDelete(l.id)}>Delete</button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="dialog-body">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="mini-thumb" style={{ width: 128, height: 72, borderRadius: 8, display: 'grid', placeItems: 'center', backgroundImage: live.imageUrl ? `url(${live.imageUrl})` : undefined }}>
            {!live.imageUrl && <SiteIcon link={live} size={32} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" className="btn btn-sm" disabled={busy || !isTauri()} onClick={refresh} title={isTauri() ? undefined : 'Works in the desktop app'}><IconRefresh size={14} />Refresh from the page</button>
            <button type="button" className="btn btn-sm" onClick={() => openExternal(live.url)}><IconExternal size={14} />Open in browser</button>
          </div>
        </div>
        <div className="hint">
          Added {formatDate(l.createdAt)}
          {live.openCount > 0 && ` · opened ${live.openCount} time${live.openCount === 1 ? '' : 's'}, last ${formatDate(live.lastOpenedAt!)}`}
          {live.metadataStatus === 'failed' && ' · the page couldn’t be read'}
        </div>
        <label className="field">Link<input className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label className="field">Title<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={live.domain} /></label>
        <label className="field">Description (1 line)<input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field">
          Category
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {[...lib.categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </label>
        {categoryId === NEW_CATEGORY && (
          <label className="field">New category name<input className="input" autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)} /></label>
        )}
        <div className="field">
          <label htmlFor="edit-link-tags">Tags</label>
          <TagInput id="edit-link-tags" value={tags} onChange={setTags} suggestions={lib.tags.map((t) => t.name)} />
        </div>
        <div className="field">
          <span>Status</span>
          <div className="ld-flags" role="group" aria-label="Status">
            <button type="button" className="flag-btn viewed" aria-pressed={viewed} onClick={() => setViewed(!viewed)}>Viewed</button>
            {LINK_FLAGS.map((f) => (
              <button type="button" key={f} className={`flag-btn ${f}`} aria-pressed={flags.includes(f)} onClick={() => setFlags(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f])}>{FLAG_LABELS[f]}</button>
            ))}
          </div>
          <span className="hint">A link counts as New until you first open it.</span>
        </div>
        <label className="field">Notes<textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you want to remember" /></label>
        {error && <div className="error">{error}</div>}
      </div>
    </Dialog>
  );
}
