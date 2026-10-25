import { useEffect, useRef, useState } from 'react';
import { closeChannelView, moveChannelView, openExternal, showChannelView } from '../lib/platform';
import { isTauri } from '../lib/storage';
import type { Bookmark } from '../lib/types';
import { displayTitle, formatDuration } from '../lib/view';
import type { PlaylistEntry } from '../lib/youtube-api';
import { errorText, useStore } from '../state';
import { Dialog } from './Dialog';
import { IconExternal, IconEye } from './Icons';

// Playlists are listed once per session; reopening one is instant and costs no quota.
const playlistCache = new Map<string, PlaylistEntry[]>();

/** Side drawer that plays a video or Short, lists a playlist's videos, or shows a channel's page. */
export function Viewer({ b, onClose, onToggleWatched }: { b: Bookmark; onClose: () => void; onToggleWatched: (b: Bookmark) => void }) {
  const title = displayTitle(b);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      variant="viewer"
      footer={
        <>
          {(b.type === 'video' || b.type === 'short') && <span className="hint">If the video won’t play here, its owner has turned off playback in other apps.</span>}
          <span className="spacer" />
          <button type="button" className="btn" aria-pressed={b.watched} onClick={() => onToggleWatched(b)}>
            <IconEye size={15} /> {b.watched ? 'Watched' : 'Mark watched'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void openExternal(b.url)}>
            <IconExternal size={15} /> Open in browser
          </button>
        </>
      }
    >
      {b.type === 'playlist' ? <PlaylistList b={b} /> : b.type === 'channel' ? <ChannelPage b={b} /> : <Player b={b} />}
    </Dialog>
  );
}

function Player({ b }: { b: Bookmark }) {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.youtubeId)}?autoplay=1&rel=0&playsinline=1`;
  return (
    <div className="viewer-body">
      <div className={`player${b.type === 'short' ? ' short' : ''}`}>
        <iframe
          src={src}
          title={displayTitle(b)}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // YouTube's player refuses to start without a referrer (error 153).
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

/**
 * The channel's YouTube page. YouTube can't be framed, so the desktop app lays its own
 * webview over this box and keeps it lined up as the window resizes.
 */
function ChannelPage({ b }: { b: Bookmark }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const url = b.channelUrl || b.url;

  useEffect(() => {
    const el = host.current;
    if (!el || !isTauri()) return;
    const rect = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    showChannelView(url, rect()).catch((e) => setError(errorText(e)));
    const follow = new ResizeObserver(() => void moveChannelView(rect()).catch(() => {}));
    follow.observe(el);
    return () => {
      follow.disconnect();
      void closeChannelView().catch(() => {});
    };
  }, [url]);

  return (
    <div className="channel-host" ref={host}>
      {!isTauri() ? <span>Channel pages show here in the desktop app. Use Open in browser.</span> : error ? <span className="error">Couldn’t show the channel: {error}</span> : <span>Loading the channel…</span>}
    </div>
  );
}

function PlaylistList({ b }: { b: Bookmark }) {
  const store = useStore();
  const [items, setItems] = useState<PlaylistEntry[] | null>(() => playlistCache.get(b.youtubeId) ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (items) return;
    let live = true;
    store.playlistItems(b.youtubeId).then(
      (list) => {
        playlistCache.set(b.youtubeId, list);
        if (live) setItems(list);
      },
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [store, b.youtubeId, items]);

  if (error) return <div className="dialog-body"><span className="error">Couldn’t list this playlist: {error}</span></div>;
  if (!items) return <div className="dialog-body"><span className="hint">Loading the playlist…</span></div>;

  const available = items.filter((i) => i.available);
  const total = available.reduce((sum, i) => sum + (i.durationSec ?? 0), 0);
  const missing = items.length - available.length;
  return (
    <div className="dialog-body playlist-body">
      <div className="playlist-summary">
        <b>{items.length} video{items.length === 1 ? '' : 's'}</b>
        <span>Total {formatDuration(total) || '0:00'}</span>
        {missing > 0 && <span className="hint">{missing} unavailable (private or deleted)</span>}
        {b.channelName && <span className="hint">by {b.channelName}</span>}
      </div>
      {items.length === 0 ? (
        <span className="hint">This playlist is empty.</span>
      ) : (
        <ol className="playlist-list">
          {items.map((i) => (
            <li key={`${i.position}-${i.videoId}`} className={i.available ? '' : 'unavailable'}>
              <span className="pos">{i.position}</span>
              {i.thumbnailUrl ? <img src={i.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="thumb-blank" />}
              <span className="pl-text">
                <span className="pl-title" title={i.title}>{i.title}</span>
                {i.channelName && <span className="hint">{i.channelName}</span>}
              </span>
              <span className="pl-dur">{i.available ? formatDuration(i.durationSec) : 'Unavailable'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
