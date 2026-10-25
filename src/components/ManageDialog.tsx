import { useState } from 'react';
import { CATEGORY_COLORS } from '../lib/types';
import { errorText, useLibrary, useStore, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconEdit, IconMerge, IconTrash } from './Icons';

export function ManageDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const lib = useLibrary();
  const toast = useToast();
  const [newCat, setNewCat] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<{ kind: 'cat' | 'tag'; id: string; name: string } | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [error, setError] = useState('');

  const catCount = (id: string) => lib.bookmarks.filter((b) => b.categoryId === id).length;
  const tagCount = (id: string) => lib.bookmarks.filter((b) => b.tagIds.includes(id)).length;
  const uncategorized = lib.bookmarks.filter((b) => !b.categoryId).length;
  const tags = [...lib.tags]
    .filter((t) => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase().replace(/^#/, '')))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cats = [...lib.categories].sort((a, b) => a.name.localeCompare(b.name));

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const commitRename = () =>
    run(async () => {
      if (!renaming || !renaming.name.trim()) return setRenaming(null);
      if (renaming.kind === 'cat') await store.updateCategory(renaming.id, { name: renaming.name });
      else await store.renameTag(renaming.id, renaming.name);
      setRenaming(null);
    });

  const renameField = (kind: 'cat' | 'tag', id: string) =>
    renaming?.kind === kind && renaming.id === id ? (
      <input
        className="input grow"
        style={{ height: 32 }}
        autoFocus
        aria-label="New name"
        value={renaming.name}
        onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commitRename();
          if (e.key === 'Escape') {
            e.stopPropagation();
            setRenaming(null);
          }
        }}
        onBlur={() => void commitRename()}
      />
    ) : null;

  return (
    <Dialog title="Manage categories and tags" variant="wide" onClose={onClose}>
      {error && <div className="error" style={{ padding: '10px 24px 0' }}>{error}</div>}
      <div className="manage-cols">
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3>Categories</h3>
            <span className="hint">One per bookmark</span>
          </div>
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (newCat.trim()) void run(async () => { await store.addCategory(newCat); setNewCat(''); });
            }}
          >
            <label className="sr-only" htmlFor="new-cat">New category name</label>
            <input id="new-cat" className="input" style={{ flex: 1 }} placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
          <div className="list scroll-list">
            {cats.map((c) => (
              <div className="list-row" key={c.id}>
                <label title="Change color" style={{ display: 'grid' }}>
                  <span className="sr-only">Color of {c.name}</span>
                  <input type="color" className="color-input" list="cat-colors" value={c.color} onChange={(e) => void run(() => store.updateCategory(c.id, { color: e.target.value }))} />
                </label>
                {renameField('cat', c.id) ?? <span className="grow" style={{ fontWeight: 500 }}>{c.name}</span>}
                {merging === c.id ? (
                  <select
                    className="select"
                    style={{ height: 32 }}
                    autoFocus
                    aria-label={`Merge ${c.name} into`}
                    defaultValue=""
                    onChange={(e) => e.target.value && void run(async () => { await store.mergeCategory(c.id, e.target.value); setMerging(null); toast({ text: `Merged ${c.name}.` }); })}
                    onBlur={() => setMerging(null)}
                  >
                    <option value="" disabled>Merge into…</option>
                    {cats.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                ) : (
                  <span className="count" style={{ width: 34, textAlign: 'right' }}>{catCount(c.id)}</span>
                )}
                <button type="button" className="icon-btn sm" aria-label={`Rename ${c.name}`} title="Rename" onClick={() => setRenaming({ kind: 'cat', id: c.id, name: c.name })}><IconEdit size={14} /></button>
                <button type="button" className="icon-btn sm" aria-label={`Merge ${c.name} into another category`} title="Merge" disabled={cats.length < 2} onClick={() => setMerging(c.id)}><IconMerge size={14} /></button>
                <button
                  type="button"
                  className="icon-btn sm"
                  aria-label={`Delete ${c.name}`}
                  title="Delete"
                  onClick={() => void run(async () => { await store.deleteCategory(c.id); toast({ text: `Deleted ${c.name}. Its bookmarks are now Uncategorized.` }); })}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
            <div className="list-row">
              <span className="swatch" style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--border-strong)' }} />
              <span className="grow" style={{ color: 'var(--muted)' }}>Uncategorized</span>
              <span className="count" style={{ width: 34, textAlign: 'right' }}>{uncategorized}</span>
              <span style={{ width: 98 }} />
            </div>
          </div>
          <datalist id="cat-colors">{CATEGORY_COLORS.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="note">Deleting a category moves its bookmarks to Uncategorized. Merging moves them into the category you pick.</div>
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3>Tags</h3>
            <span className="hint">Any number per bookmark</span>
          </div>
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (tagQuery.trim()) void run(async () => { await store.addTag(tagQuery); setTagQuery(''); });
            }}
          >
            <label className="sr-only" htmlFor="tag-q">Find or add a tag</label>
            <input id="tag-q" className="input" style={{ flex: 1 }} placeholder="Find or add a tag" value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} />
            <button className="btn" type="submit">Add</button>
          </form>
          <div className="list scroll-list">
            {tags.length === 0 && <div className="list-row hint">No tags{tagQuery ? ' match' : ' yet'}.</div>}
            {tags.map((t) => (
              <div className="list-row" key={t.id} style={{ minHeight: 40 }}>
                <input
                  type="checkbox"
                  aria-label={`Select #${t.name}`}
                  checked={selectedTags.includes(t.id)}
                  onChange={(e) => setSelectedTags((xs) => (e.target.checked ? [...xs, t.id] : xs.filter((x) => x !== t.id)))}
                />
                {renameField('tag', t.id) ?? <span className="grow">#{t.name}</span>}
                <span className="count" style={{ width: 34, textAlign: 'right' }}>{tagCount(t.id)}</span>
                <button type="button" className="icon-btn sm" aria-label={`Rename #${t.name}`} title="Rename" onClick={() => setRenaming({ kind: 'tag', id: t.id, name: t.name })}><IconEdit size={14} /></button>
                <button type="button" className="icon-btn sm" aria-label={`Delete #${t.name}`} title="Delete" onClick={() => void run(() => store.deleteTags([t.id]))}><IconTrash size={14} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="hint" style={{ flex: 1 }}>{selectedTags.length < 2 ? 'Select two or more to merge. Renaming a tag to an existing name also merges.' : `${selectedTags.length} selected`}</span>
            {selectedTags.length >= 2 && (
              <select
                className="select"
                style={{ height: 34 }}
                aria-label="Merge selected into"
                defaultValue=""
                onChange={(e) => {
                  const to = e.target.value;
                  if (to) void run(async () => { await store.mergeTags(selectedTags, to); setSelectedTags([]); toast({ text: 'Tags merged.' }); });
                }}
              >
                <option value="" disabled>Merge into…</option>
                {selectedTags.map((id) => <option key={id} value={id}>#{lib.tags.find((t) => t.id === id)?.name}</option>)}
              </select>
            )}
            {selectedTags.length > 0 && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => void run(async () => { await store.deleteTags(selectedTags); setSelectedTags([]); })}>Delete selected</button>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
