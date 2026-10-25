import { memo } from 'react';
import { openExternal } from '../lib/platform';
import { TYPE_LABELS, type Bookmark, type Category, type Tag } from '../lib/types';
import { displayTitle, formatDate, metaLabel, relativeDay } from '../lib/view';
import { IconEdit, IconExternal, IconEye, IconPlay, IconPlus, IconTrash } from './Icons';

interface Props {
  b: Bookmark;
  category?: Category;
  tags: Tag[];
  selected: boolean;
  flash: boolean;
  fetching: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleWatched: (b: Bookmark) => void;
  onTagClick: (tagId: string) => void;
  onQuickEdit: (id: string, kind: 'category' | 'tags', anchor: HTMLElement) => void;
  onView: (b: Bookmark) => void;
}

function BookmarkCardImpl({ b, category, tags, selected, flash, fetching, onSelect, onEdit, onDelete, onToggleWatched, onTagClick, onQuickEdit, onView }: Props) {
  const title = displayTitle(b);
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    onView(b);
  };
  const meta = metaLabel(b);
  const shown = tags.slice(0, 2);
  return (
    <article className={`card${selected ? ' selected' : ''}${flash ? ' flash' : ''}`} data-id={b.id}>
      <a href={b.url} className={`thumb ${b.type}${b.watched ? ' watched' : ''}`} onClick={open} aria-label={b.type === 'playlist' ? `Show the videos in ${title}` : b.type === 'channel' ? `Open ${title}` : `Play ${title}`}>
        {b.thumbnailUrl ? (
          <img src={b.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="thumb-placeholder"><IconPlay size={22} /></span>
        )}
        <span className="badge type">{TYPE_LABELS[b.type]}</span>
        {meta && <span className="badge meta">{meta}</span>}
        {b.watched && <span className="badge watched">Watched</span>}
      </a>
      <label className="card-check">
        <span className="sr-only">Select {title}</span>
        <input type="checkbox" checked={selected} onChange={() => onSelect(b.id)} />
      </label>
      <div className="card-actions">
        <button type="button" aria-label="Open in browser" title="Open in browser" onClick={() => void openExternal(b.url)}><IconExternal size={14} /></button>
        <button type="button" aria-label="Edit bookmark" title="Edit" onClick={() => onEdit(b.id)}><IconEdit size={14} /></button>
        <button type="button" aria-label="Delete bookmark" title="Delete" onClick={() => onDelete(b.id)}><IconTrash size={14} /></button>
      </div>
      <div className="card-body">
        <a href={b.url} className="card-title" onClick={open} title={title}>{title}</a>
        <div className="card-sub">
          {b.channelName && b.channelUrl ? (
            <a
              href={b.channelUrl}
              className="channel-link"
              title={`Open ${b.channelName} on YouTube`}
              onClick={(e) => {
                e.preventDefault();
                void openExternal(b.channelUrl);
              }}
            >
              {b.channelName}
            </a>
          ) : (
            <span className="ellipsis">{b.channelName || (fetching ? 'Fetching details…' : '')}</span>
          )}
          <span title={`Added ${formatDate(b.createdAt)}`} style={{ flex: 'none' }}>{relativeDay(b.createdAt)}</span>
        </div>
        <div className="card-desc" title={b.description}>
          {b.description || (b.metadataStatus === 'failed' ? <span className="status-dot failed">Couldn’t fetch details</span> : b.metadataStatus === 'partial' ? <span className="status-dot">Add an API key to fetch details</span> : '')}
        </div>
        <div className="card-tags">
          {shown.map((t) => (
            <button type="button" key={t.id} className="tag-pill" title={`Show bookmarks tagged #${t.name}`} onClick={() => onTagClick(t.id)}>#{t.name}</button>
          ))}
          {tags.length > shown.length && <span className="tag-pill more" title={tags.slice(shown.length).map((t) => `#${t.name}`).join(' ')}>+{tags.length - shown.length}</span>}
          <button type="button" className="tag-add" aria-label="Edit tags" title="Add or remove tags" onClick={(e) => onQuickEdit(b.id, 'tags', e.currentTarget)}>
            <IconPlus size={11} />{tags.length ? '' : 'Tag'}
          </button>
        </div>
        <div className="card-foot">
          <button
            type="button"
            className={`cat-pill${category ? '' : ' unset'}`}
            title={category ? `${category.name} (click to change)` : 'Set a category'}
            aria-label={category ? `Category ${category.name}, change` : 'Set a category'}
            onClick={(e) => onQuickEdit(b.id, 'category', e.currentTarget)}
          >
            {category && <span className="swatch" style={{ background: category.color }} />}
            {category ? category.name : 'Uncategorized'}
          </button>
          <button
            type="button"
            className="eye"
            aria-pressed={b.watched}
            aria-label={b.watched ? 'Mark as unwatched' : 'Mark as watched'}
            title={b.watched ? 'Watched (click to mark unwatched)' : 'Mark as watched'}
            onClick={() => onToggleWatched(b)}
          >
            <IconEye size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

export const BookmarkCard = memo(BookmarkCardImpl);
