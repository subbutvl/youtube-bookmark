import { useEffect, useRef, useState } from 'react';
import { QUICK_LAUNCH_MAX, type Link } from '../lib/link-types';
import { linkTitle } from '../lib/link-view';
import { fold } from '../lib/view';
import { errorText, useLinks, useLinkStore, useToast } from '../state';
import { IconClose, IconPlus } from './Icons';
import { SiteIcon } from './LinkCard';

/** The pinned links as a row of icons: click to open, drag to reorder, × to unpin. */
export function QuickLaunch({ onOpen }: { onOpen: (l: Link) => void }) {
  const store = useLinkStore();
  useLinks(); // re-render when pins change
  const toast = useToast();
  const pinned = store.quickLaunch;
  const [order, setOrder] = useState<string[] | null>(null);
  const [picking, setPicking] = useState(false);
  const dragging = useRef<string | null>(null);

  const shown = order ? order.map((id) => pinned.find((l) => l.id === id)).filter((l): l is Link => !!l) : pinned;

  const drop = () => {
    if (order) void store.reorderQuickLaunch(order).catch((e) => toast({ text: errorText(e) }));
    setOrder(null);
    dragging.current = null;
  };

  return (
    <section className="quick-launch" aria-label="Quick launch">
      <span className="ql-label">Quick launch</span>
      {shown.length === 0 && <span className="hint">Pin up to {QUICK_LAUNCH_MAX} links you open often. Use the pin on any link, or the + here.</span>}
      {shown.map((l) => (
        <div
          key={l.id}
          className={`ql-item${order && dragging.current === l.id ? ' dragging' : ''}`}
          draggable
          onDragStart={(e) => {
            dragging.current = l.id;
            e.dataTransfer.effectAllowed = 'move';
            setOrder(pinned.map((x) => x.id));
          }}
          onDragOver={(e) => {
            e.preventDefault();
            const from = dragging.current;
            if (!from || from === l.id || !order) return;
            const next = order.filter((id) => id !== from);
            next.splice(next.indexOf(l.id) + (order.indexOf(from) < order.indexOf(l.id) ? 1 : 0), 0, from);
            setOrder(next);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop();
          }}
          onDragEnd={drop}
        >
          <button type="button" className="ql-open" title={`${linkTitle(l)}\n${l.url}`} onClick={() => onOpen(l)}>
            <span className="ql-icon"><SiteIcon link={l} size={22} /></span>
            <span className="ql-name">{linkTitle(l)}</span>
          </button>
          <button type="button" className="ql-unpin" aria-label={`Unpin ${linkTitle(l)}`} title="Unpin" onClick={() => void store.unpin(l.id)}><IconClose size={11} /></button>
        </div>
      ))}
      {pinned.length < QUICK_LAUNCH_MAX && (
        <div className="ql-add-wrap">
          <button type="button" className="ql-add" aria-label="Pin a link" title="Pin a link" aria-expanded={picking} onClick={() => setPicking((p) => !p)}><IconPlus size={16} /></button>
          {picking && <PinPicker onClose={() => setPicking(false)} />}
        </div>
      )}
    </section>
  );
}

function PinPicker({ onClose }: { onClose: () => void }) {
  const store = useLinkStore();
  const lib = useLinks();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener('mousedown', away);
    return () => window.removeEventListener('mousedown', away);
  }, [onClose]);
  const words = fold(q).split(/\s+/).filter(Boolean);
  const matches = lib.links
    .filter((l) => l.quickLaunch == null && words.every((w) => fold(`${l.title} ${l.url}`).includes(w)))
    .sort((a, b) => b.openCount - a.openCount || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const pin = (l: Link) => void store.pin(l.id).then(onClose, (e) => toast({ text: errorText(e) }));
  return (
    <div ref={ref} className="quick-edit ql-picker" role="dialog" aria-label="Pin a link">
      <input
        className="input"
        autoFocus
        placeholder="Find a link to pin"
        aria-label="Find a link to pin"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
          if (e.key === 'Enter' && matches[0]) pin(matches[0]);
        }}
      />
      <div className="qe-list">
        {matches.map((l) => (
          <button type="button" key={l.id} className="qe-item" onClick={() => pin(l)}>
            <SiteIcon link={l} size={16} />
            <span className="grow">{linkTitle(l)}</span>
          </button>
        ))}
        {!matches.length && <div className="hint" style={{ padding: 8 }}>No links match.</div>}
      </div>
    </div>
  );
}
