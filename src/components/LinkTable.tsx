import { Fragment } from 'react';
import { FLAG_LABELS, LINK_FLAGS, type Link, type LinkFlag } from '../lib/link-types';
import { linkTitle, type LinkRow } from '../lib/link-view';
import type { Category, Tag } from '../lib/types';
import { formatDate } from '../lib/view';
import { IconChevronDown, IconEdit, IconExternal, IconEye, IconPin, IconTrash } from './Icons';
import { LinkBadges, SiteIcon } from './LinkCard';

interface Props {
  rows: LinkRow[];
  expanded: Set<string>;
  onToggleGroup: (domain: string) => void;
  catById: Map<string, Category>;
  tagById: Map<string, Tag>;
  selected: Set<string>;
  flashId: string | null;
  onSelect: (id: string) => void;
  onSelectMany: (ids: string[], on: boolean) => void;
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

/** Links as rows: one line each, with sites that have several links folded into an expandable row. */
export function LinkTable(p: Props) {
  const all = p.rows.flatMap((r) => (r.kind === 'group' ? r.links : [r.link]));
  const allSelected = all.length > 0 && all.every((l) => p.selected.has(l.id));

  const row = (l: Link, child = false) => {
    const cat = l.categoryId ? p.catById.get(l.categoryId) : undefined;
    const tags = l.tagIds.map((t) => p.tagById.get(t)).filter((t): t is Tag => !!t);
    const title = linkTitle(l);
    return (
      <tr key={l.id} data-id={l.id} className={`${child ? 'child ' : ''}${p.selected.has(l.id) ? 'selected ' : ''}${p.flashId === l.id ? 'flash' : ''}`}>
        <td className="c-check"><input type="checkbox" aria-label={`Select ${title}`} checked={p.selected.has(l.id)} onChange={() => p.onSelect(l.id)} /></td>
        <td className="c-title">
          <SiteIcon link={l} size={18} />
          <span className="t-text">
            <button type="button" className="t-link" title={title} onClick={() => p.onOpen(l)}>{title}</button>
            <span className="hint t-url" title={l.url}>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </span>
        </td>
        <td>
          <button type="button" className={`cat-pill${cat ? '' : ' unset'}`} onClick={(e) => p.onQuickEdit(l.id, 'category', e.currentTarget)}>
            {cat && <span className="swatch" style={{ background: cat.color }} />}{cat?.name ?? 'Category'}
          </button>
        </td>
        <td className="c-tags">
          {tags.slice(0, 2).map((t) => <button type="button" key={t.id} className="tag-pill" onClick={() => p.onTagClick(t.id)}>#{t.name}</button>)}
          <button type="button" className="tag-add" onClick={(e) => p.onQuickEdit(l.id, 'tags', e.currentTarget)}>{tags.length > 2 ? `+${tags.length - 2}` : '+'}</button>
        </td>
        <td className="c-status"><LinkBadges l={{ ...l, flags: [] }} /></td>
        <td className="c-flags">
          {LINK_FLAGS.map((f) => (
            <button type="button" key={f} className={`flag-btn ${f}`} aria-pressed={l.flags.includes(f)} onClick={() => p.onToggleFlag(l, f)}>{FLAG_LABELS[f]}</button>
          ))}
        </td>
        <td className="c-num">{l.openCount || ''}</td>
        <td className="c-date">{formatDate(l.createdAt)}</td>
        <td className="c-actions">
          <button type="button" className="icon-btn sm" aria-pressed={l.viewed} aria-label={l.viewed ? 'Mark not viewed' : 'Mark viewed'} title={l.viewed ? 'Viewed' : 'Mark viewed'} onClick={() => p.onToggleViewed(l)}><IconEye size={14} /></button>
          <button type="button" className="icon-btn sm" aria-pressed={l.quickLaunch != null} aria-label={l.quickLaunch != null ? 'Unpin from quick launch' : 'Pin to quick launch'} title={l.quickLaunch != null ? 'Unpin' : 'Pin to quick launch'} onClick={() => p.onTogglePin(l)}><IconPin size={14} /></button>
          <button type="button" className="icon-btn sm" aria-label="Open in browser" title="Open in browser" onClick={() => p.onOpenExternal(l)}><IconExternal size={14} /></button>
          <button type="button" className="icon-btn sm" aria-label="Edit" title="Edit" onClick={() => p.onEdit(l.id)}><IconEdit size={14} /></button>
          <button type="button" className="icon-btn sm" aria-label="Delete" title="Delete" onClick={() => p.onDelete(l.id)}><IconTrash size={14} /></button>
        </td>
      </tr>
    );
  };

  return (
    <div className="table-wrap">
      <table className="link-table">
        <thead>
          <tr>
            <th className="c-check"><input type="checkbox" aria-label="Select all shown" checked={allSelected} onChange={() => p.onSelectMany(all.map((l) => l.id), !allSelected)} /></th>
            <th>Title</th>
            <th>Category</th>
            <th>Tags</th>
            <th>Status</th>
            <th>Flags</th>
            <th className="c-num">Opened</th>
            <th>Added</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r) => {
            if (r.kind === 'link') return row(r.link);
            const open = p.expanded.has(r.domain);
            return (
              <Fragment key={`g:${r.domain}`}>
                <tr className="group-row">
                  <td className="c-check">
                    <input type="checkbox" aria-label={`Select all ${r.links.length} from ${r.domain}`} checked={r.links.every((l) => p.selected.has(l.id))} onChange={(e) => p.onSelectMany(r.links.map((l) => l.id), e.target.checked)} />
                  </td>
                  <td colSpan={8}>
                    <button type="button" className="group-toggle" aria-expanded={open} onClick={() => p.onToggleGroup(r.domain)}>
                      <IconChevronDown size={16} className={open ? '' : 'rot'} />
                      <SiteIcon link={r.links[0]} size={18} />
                      <b>{r.domain}</b>
                      <span className="count">{r.links.length} links</span>
                      {!open && <span className="hint group-peek">{r.links.slice(0, 3).map(linkTitle).join(' · ')}</span>}
                    </button>
                  </td>
                </tr>
                {open && r.links.map((l) => row(l, true))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
