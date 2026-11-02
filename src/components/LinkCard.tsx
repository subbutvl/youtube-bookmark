import { memo, useState } from 'react';
import { FLAG_LABELS, isNew, LINK_FLAGS, type Link, type LinkFlag } from '../lib/link-types';
import { fallbackFavicon } from '../lib/link-url';
import { linkTitle } from '../lib/link-view';
import type { Category, Tag } from '../lib/types';
import { relativeDay } from '../lib/view';
import { IconEdit, IconExternal, IconEye, IconPin, IconPlus, IconTrash } from './Icons';

const TILE_COLORS = ['#2457C5', '#C2331F', '#1F8A5B', '#7A3FC2', '#B5641A', '#0E7C86', '#B8326B', '#4B5563'];

/** A steady color per site for icon tiles. */
export function domainColor(domain: string): string {
  let h = 0;
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

/** The site's icon, or its first letter on a colored tile when the icon won't load. */
export function SiteIcon({ link, size = 20 }: { link: Pick<Link, 'domain' | 'faviconUrl'>; size?: number }) {
  const [src, setSrc] = useState(link.faviconUrl || fallbackFavicon(link.domain));
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="site-letter" style={{ width: size, height: size, fontSize: size * 0.55, background: domainColor(link.domain) }} aria-hidden="true">
        {link.domain.replace(/^www\./, '')[0]?.toUpperCase() ?? '?'}
      </span>
    );
  }
  return (
    <img
      className="site-icon"
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        const fallback = fallbackFavicon(link.domain);
        if (src !== fallback) setSrc(fallback);
        else setFailed(true);
      }}
    />
  );
}

/** New / Viewed and each flag the link carries. */
export function LinkBadges({ l }: { l: Link }) {
  return (
    <>
      {isNew(l) ? <span className="lbadge new">New</span> : l.viewed ? <span className="lbadge viewed">Viewed</span> : null}
      {l.flags.map((f) => <span key={f} className={`lbadge ${f}`}>{FLAG_LABELS[f]}</span>)}
    </>
  );
}

interface Props {
  l: Link;
  category?: Category;
  tags: Tag[];
  selected: boolean;
  flash: boolean;
  fetching: boolean;
  onSelect: (id: string) => void;
  onOpen: (l: Link) => void;
  onOpenExternal: (l: Link) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleViewed: (l: Link) => void;
  onToggleFlag: (l: Link, f: LinkFlag) => void;
  onTogglePin: (l: Link) => void;
  onTagClick: (id: string) => void;
  onQuickEdit: (id: string, kind: 'category' | 'tags', el: HTMLElement) => void;
}

export const LinkCard = memo(function LinkCard({ l, category, tags, selected, flash, fetching, onSelect, onOpen, onOpenExternal, onEdit, onDelete, onToggleViewed, onToggleFlag, onTogglePin, onTagClick, onQuickEdit }: Props) {
  const title = linkTitle(l);
  const [imgOk, setImgOk] = useState(true);
  return (
    <article className={`card link-card${selected ? ' selected' : ''}${flash ? ' flash' : ''}`} data-id={l.id}>
      <button type="button" className="thumb link-thumb" onClick={() => onOpen(l)} aria-label={`Open ${title}`} style={l.imageUrl && imgOk ? undefined : { background: `${domainColor(l.domain)}1f` }}>
        {l.imageUrl && imgOk ? (
          <img src={l.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        ) : (
          <span className="thumb-placeholder"><SiteIcon link={l} size={44} /></span>
        )}
        {l.quickLaunch != null && <span className="badge type">Pinned</span>}
      </button>
      <label className="card-check">
        <span className="sr-only">Select {title}</span>
        <input type="checkbox" checked={selected} onChange={() => onSelect(l.id)} />
      </label>
      <div className="card-actions">
        <button type="button" aria-label={l.quickLaunch != null ? 'Remove from quick launch' : 'Pin to quick launch'} title={l.quickLaunch != null ? 'Unpin from quick launch' : 'Pin to quick launch'} aria-pressed={l.quickLaunch != null} onClick={() => onTogglePin(l)}><IconPin size={15} /></button>
        <button type="button" aria-label="Open in browser" title="Open in browser" onClick={() => onOpenExternal(l)}><IconExternal size={15} /></button>
        <button type="button" aria-label="Edit" title="Edit" onClick={() => onEdit(l.id)}><IconEdit size={15} /></button>
        <button type="button" aria-label="Delete" title="Delete" onClick={() => onDelete(l.id)}><IconTrash size={15} /></button>
      </div>
      <div className="card-body">
        <button type="button" className="card-title" title={title} onClick={() => onOpen(l)}>{title}</button>
        <div className="card-sub">
          <span className="ellipsis site-line"><SiteIcon link={l} size={14} />{l.domain}</span>
          <span style={{ flex: 'none' }}>{fetching ? 'Fetching…' : relativeDay(l.createdAt)}</span>
        </div>
        <div className="card-desc" title={l.description}>{l.description}</div>
        <div className="lbadges">
          <LinkBadges l={{ ...l, flags: [] }} />
          <span className="flag-btns">
            {LINK_FLAGS.map((f) => (
              <button type="button" key={f} className={`flag-btn ${f}`} aria-pressed={l.flags.includes(f)} onClick={() => onToggleFlag(l, f)} title={l.flags.includes(f) ? `Remove ${FLAG_LABELS[f]}` : `Mark ${FLAG_LABELS[f]}`}>
                {FLAG_LABELS[f]}
              </button>
            ))}
          </span>
        </div>
        <div className="card-tags">
          {tags.slice(0, 3).map((t) => <button type="button" key={t.id} className="tag-pill" onClick={() => onTagClick(t.id)}>#{t.name}</button>)}
          {tags.length > 3 && <span className="tag-pill more">+{tags.length - 3}</span>}
          <button type="button" className="tag-add" aria-label="Edit tags" onClick={(e) => onQuickEdit(l.id, 'tags', e.currentTarget)}><IconPlus size={11} />tag</button>
        </div>
        <div className="card-foot">
          <button type="button" className={`cat-pill${category ? '' : ' unset'}`} onClick={(e) => onQuickEdit(l.id, 'category', e.currentTarget)} title="Change category">
            {category && <span className="swatch" style={{ background: category.color }} />}
            {category?.name ?? 'Category'}
          </button>
          <button type="button" className="eye" aria-pressed={l.viewed} aria-label={l.viewed ? 'Mark not viewed' : 'Mark viewed'} title={l.viewed ? 'Viewed' : 'Mark viewed'} onClick={() => onToggleViewed(l)}><IconEye size={15} /></button>
        </div>
      </div>
    </article>
  );
});
