import { useState } from 'react';
import { openExternal } from '../lib/platform';
import type { Bookmark, BookmarkType } from '../lib/types';
import { formatDate } from '../lib/view';
import { errorText, useLibrary, useStore, useToast } from '../state';
import { Dialog, TagInput } from './Dialog';
import { IconLink, IconRefresh } from './Icons';

interface Props {
  bookmark: Bookmark;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const NEW_CATEGORY = '__new__';

export function EditDrawer({ bookmark: b, onClose, onDelete }: Props) {
  const store = useStore();
  const lib = useLibrary();
  const toast = useToast();
  const tagName = new Map(lib.tags.map((t) => [t.id, t.name]));
  const [title, setTitle] = useState(b.title);
  const [description, setDescription] = useState(b.description);
  const [type, setType] = useState<BookmarkType>(b.type);
  const [categoryId, setCategoryId] = useState(b.categoryId ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [tags, setTags] = useState(b.tagIds.map((t) => tagName.get(t) ?? '').filter(Boolean));
  const [notes, setNotes] = useState(b.notes);
  const [watched, setWatched] = useState(b.watched);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = lib.bookmarks.find((x) => x.id === b.id) ?? b;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      let cat: string | null = categoryId || null;
      if (categoryId === NEW_CATEGORY) cat = newCategory.trim() ? (await store.addCategory(newCategory)).id : null;
      await store.updateBookmark(b.id, { title, description, type, categoryId: cat, notes, watched }, tags);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!store.hasApiKey) {
      toast({ text: 'Add a YouTube API key in Settings to fetch details.' });
      return;
    }
    setBusy(true);
    try {
      await store.refreshMetadata([b.id]);
      const fresh = store.getSnapshot().bookmarks.find((x) => x.id === b.id);
      if (fresh) {
        setTitle(fresh.title);
        setDescription(fresh.description);
      }
      toast({ text: fresh?.metadataStatus === 'ok' ? 'Details refreshed from YouTube.' : 'YouTube didn’t return details for this link.' });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Edit bookmark"
      variant="drawer"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-danger" onClick={() => onDelete(b.id)}>Delete</button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="dialog-body">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="mini-thumb" style={{ width: 128, height: 72, borderRadius: 8, backgroundImage: live.thumbnailUrl ? `url(${live.thumbnailUrl})` : undefined }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={refresh}><IconRefresh size={14} />Refresh from YouTube</button>
            <button type="button" className="btn btn-sm" onClick={() => openExternal(live.url)}><IconLink size={14} />Open on YouTube</button>
          </div>
        </div>
        <div className="hint">Added {formatDate(b.createdAt)} · <span style={{ wordBreak: 'break-all' }}>{live.url}</span></div>
        <label className="field">Title<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field">Description (1 line)<input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="two-col">
          <label className="field">
            Type
            <select className="select" value={type} onChange={(e) => setType(e.target.value as BookmarkType)}>
              <option value="video">Video</option>
              <option value="short">Short</option>
              <option value="playlist">Playlist</option>
              <option value="channel">Channel</option>
            </select>
          </label>
          <label className="field">
            Category
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {lib.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          </label>
        </div>
        {categoryId === NEW_CATEGORY && (
          <label className="field">New category name<input className="input" autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)} /></label>
        )}
        <div className="field">
          <label htmlFor="edit-tags">Tags</label>
          <TagInput id="edit-tags" value={tags} onChange={setTags} suggestions={lib.tags.map((t) => t.name)} />
        </div>
        <label className="field">Notes<textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you want to remember" /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <input type="checkbox" checked={watched} onChange={(e) => setWatched(e.target.checked)} style={{ width: 18, height: 18 }} />
          Watched
        </label>
        {error && <div className="error">{error}</div>}
      </div>
    </Dialog>
  );
}
