import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { errorText, useEscape, useTaxonomy, useToast, type Mode } from '../state';
import { IconPlus } from './Icons';

export interface QuickEditTarget {
  id: string;
  kind: 'category' | 'tags';
  anchor: DOMRect;
}

const WIDTH = 280;

/** Small popover for changing one bookmark's category or tags right from its card. */
export function QuickEdit({ target, onClose, mode = 'youtube' }: { target: QuickEditTarget; onClose: () => void; mode?: Mode }) {
  const { ops: store, items, categories, tags: allTags } = useTaxonomy(mode);
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: target.anchor.bottom + 6, left: target.anchor.left });
  const b = items.find((x) => x.id === target.id);
  useEscape(onClose);

  // Keep the popover on screen: flip above the anchor if there's no room below.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 300;
    const left = Math.max(8, Math.min(target.anchor.left, window.innerWidth - WIDTH - 8));
    const below = target.anchor.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, target.anchor.top - h - 6) : below;
    setPos({ top, left });
  }, [target]);

  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener('mousedown', away);
    return () => window.removeEventListener('mousedown', away);
  }, [onClose]);

  if (!b) return null;
  const q = query.trim().replace(/^#/, '');
  const ql = q.toLowerCase();
  const run = (fn: () => Promise<unknown>) => fn().catch((e) => toast({ text: errorText(e) }));

  let body;
  if (target.kind === 'category') {
    const cats = [...categories].sort((x, y) => x.name.localeCompare(y.name)).filter((c) => c.name.toLowerCase().includes(ql));
    const exact = categories.some((c) => c.name.toLowerCase() === ql);
    const pick = (fn: () => Promise<unknown>) => run(async () => { await fn(); onClose(); });
    body = (
      <>
        <input className="input" autoFocus placeholder="Find or create a category" aria-label="Find or create a category" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !q) return;
            e.preventDefault();
            const match = cats[0] && cats[0].name.toLowerCase() === ql ? cats[0] : null;
            pick(() => (match ? store.setCategory([b.id], match.id) : store.setCategoryByName([b.id], q)));
          }}
        />
        <div className="qe-list" role="listbox" aria-label="Categories">
          {cats.map((c) => (
            <button type="button" role="option" aria-selected={b.categoryId === c.id} key={c.id} className="qe-item" onClick={() => pick(() => store.setCategory([b.id], c.id))}>
              <span className="swatch" style={{ background: c.color }} />
              <span className="grow">{c.name}</span>
              {b.categoryId === c.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          {!q && (
            <button type="button" role="option" aria-selected={!b.categoryId} className="qe-item" onClick={() => pick(() => store.setCategory([b.id], null))}>
              <span className="swatch" style={{ background: 'var(--border-strong)' }} />
              <span className="grow" style={{ color: 'var(--muted)' }}>Uncategorized</span>
              {!b.categoryId && <span aria-hidden="true">✓</span>}
            </button>
          )}
          {q && !exact && (
            <button type="button" className="qe-item" onClick={() => pick(() => store.setCategoryByName([b.id], q))}>
              <IconPlus size={14} /><span className="grow">Create “{q}”</span>
            </button>
          )}
        </div>
      </>
    );
  } else {
    const names = b.tagIds.map((id) => allTags.find((t) => t.id === id)?.name).filter((n): n is string => !!n);
    const has = (n: string) => names.some((x) => x.toLowerCase() === n.toLowerCase());
    const tags = [...allTags]
      .filter((t) => t.name.toLowerCase().includes(ql))
      .sort((x, y) => Number(b.tagIds.includes(y.id)) - Number(b.tagIds.includes(x.id)) || x.name.localeCompare(y.name))
      .slice(0, 60);
    const exact = allTags.some((t) => t.name.toLowerCase() === ql);
    const toggle = (n: string) => run(() => store.setTags(b.id, has(n) ? names.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...names, n]));
    body = (
      <>
        <input className="input" autoFocus placeholder="Find or add a tag, press Enter" aria-label="Find or add a tag" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !q) return;
            e.preventDefault();
            if (!has(q)) toggle(q);
            setQuery('');
          }}
        />
        <div className="qe-list" aria-label="Tags">
          {tags.map((t) => (
            <label key={t.id} className="qe-item">
              <input type="checkbox" checked={b.tagIds.includes(t.id)} onChange={() => toggle(t.name)} />
              <span className="grow">#{t.name}</span>
            </label>
          ))}
          {q && !exact && (
            <button type="button" className="qe-item" onClick={() => { toggle(q); setQuery(''); }}>
              <IconPlus size={14} /><span className="grow">Add #{q}</span>
            </button>
          )}
          {!tags.length && !q && <div className="hint" style={{ padding: 8 }}>No tags yet. Type one above.</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>Done</button>
        </div>
      </>
    );
  }

  return (
    <div ref={ref} className="quick-edit" role="dialog" aria-label={target.kind === 'category' ? 'Change category' : 'Edit tags'} style={{ top: pos.top, left: pos.left, width: WIDTH }}>
      {body}
    </div>
  );
}
