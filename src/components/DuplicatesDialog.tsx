import { useMemo } from 'react';
import type { Link } from '../lib/link-types';
import { nearKey } from '../lib/link-url';
import { linkTitle } from '../lib/link-view';
import { formatDate } from '../lib/view';
import { useLinks } from '../state';
import { Dialog } from './Dialog';
import { IconTrash } from './Icons';
import { SiteIcon } from './LinkCard';

/**
 * Exact duplicates can't be saved, so this finds the near ones: the same page with a different
 * query string, or the same title on the same site.
 */
export function findNearDuplicates(links: Link[]): Link[][] {
  const groups = new Map<string, Link[]>();
  const add = (key: string, l: Link) => {
    const g = groups.get(key);
    if (g) g.push(l);
    else groups.set(key, [l]);
  };
  for (const l of links) {
    add(`k:${nearKey(l.dedupeKey)}`, l);
    if (l.title.trim()) add(`t:${l.domain}|${l.title.trim().toLowerCase()}`, l);
  }
  // A pair found both ways is listed once.
  const seen = new Set<string>();
  const out: Link[][] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sig = g.map((l) => l.id).sort().join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push([...g].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }
  return out;
}

export function DuplicatesDialog({ onClose, onDelete }: { onClose: () => void; onDelete: (ids: string[]) => void }) {
  const lib = useLinks();
  const groups = useMemo(() => findNearDuplicates(lib.links), [lib.links]);
  const extra = groups.reduce((n, g) => n + g.length - 1, 0);
  return (
    <Dialog
      title="Find duplicates"
      variant="wide"
      onClose={onClose}
      footer={
        <>
          <span className="hint">The same link is never saved twice. These are near matches: the same page with different parameters, or the same title on one site.</span>
          <span className="spacer" />
          {groups.length > 0 && <button type="button" className="btn" onClick={() => onDelete(groups.flatMap((g) => g.slice(1).map((l) => l.id)))}>Keep the oldest of each, delete {extra}</button>}
          <button type="button" className="btn" onClick={onClose}>Done</button>
        </>
      }
    >
      <div className="dialog-body" style={{ gap: 14 }}>
        {groups.length === 0 && <div className="empty" style={{ padding: 30 }}><span>No near duplicates found.</span></div>}
        {groups.map((g) => (
          <div className="list" key={g.map((l) => l.id).join()}>
            {g.map((l, i) => (
              <div className="list-row" key={l.id}>
                <SiteIcon link={l} size={18} />
                <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkTitle(l)}</span>
                  <span className="hint" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.url}</span>
                </span>
                <span className="hint" style={{ flex: 'none' }}>{i === 0 ? 'Oldest · ' : ''}{formatDate(l.createdAt)}</span>
                <button type="button" className="icon-btn sm" aria-label={`Delete ${linkTitle(l)}`} title="Delete" onClick={() => onDelete([l.id])}><IconTrash size={14} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
