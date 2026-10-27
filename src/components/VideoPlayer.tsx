import { useLayoutEffect, useRef, useState } from 'react';
import { openExternal } from '../lib/platform';
import type { Bookmark } from '../lib/types';
import { displayTitle } from '../lib/view';
import { Dialog } from './Dialog';
import { IconClose, IconExternal, IconEye, IconMaximize, IconPip } from './Icons';

export type PlayerMode = 'drawer' | 'pip';

interface Props {
  b: Bookmark;
  mode: PlayerMode;
  setMode: (m: PlayerMode) => void;
  onClose: () => void;
  onToggleWatched: (b: Bookmark) => void;
}

/**
 * Plays a video or Short in the viewer drawer or as a small picture-in-picture player.
 * The iframe never moves in the DOM (moving it would restart the video): in the drawer it is
 * laid over an empty slot, and in picture-in-picture it is pinned to the bottom right.
 */
export function VideoPlayer({ b, mode, setMode, onClose, onToggleWatched }: Props) {
  const title = displayTitle(b);
  const slot = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.youtubeId)}?autoplay=1&rel=0&playsinline=1`;

  // Follow the drawer's slot every frame, so the player keeps up with resizes and the drawer's own layout.
  useLayoutEffect(() => {
    if (mode !== 'drawer') return;
    let frame = 0;
    const follow = () => {
      const r = slot.current?.getBoundingClientRect();
      if (r) setRect((old) => (old && old.top === r.top && old.left === r.left && old.width === r.width && old.height === r.height ? old : { top: r.top, left: r.left, width: r.width, height: r.height }));
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const short = b.type === 'short';
  const pip = mode === 'pip';
  return (
    <>
      {!pip && (
        <Dialog
          title={title}
          onClose={onClose}
          variant="viewer"
          footer={
            <>
              <span className="hint">If the video won’t play here, its owner has turned off playback in other apps.</span>
              <span className="spacer" />
              <button type="button" className="btn" aria-pressed={b.watched} onClick={() => onToggleWatched(b)}>
                <IconEye size={15} /> {b.watched ? 'Watched' : 'Mark watched'}
              </button>
              <button type="button" className="btn" title="Keep playing in a small player while you browse" onClick={() => setMode('pip')}>
                <IconPip size={15} /> Picture in picture
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void openExternal(b.url)}>
                <IconExternal size={15} /> Open in browser
              </button>
            </>
          }
        >
          <div className="viewer-body">
            <div ref={slot} className={`player${short ? ' short' : ''}`} />
          </div>
        </Dialog>
      )}
      <div
        className={`floating-player${pip ? ' pip' : ''}${short ? ' short' : ''}`}
        style={pip ? undefined : rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : { visibility: 'hidden' }}
        role={pip ? 'region' : undefined}
        aria-label={pip ? `Now playing: ${title}` : undefined}
      >
        {pip && (
          <div className="pip-bar">
            <span className="pip-title" title={title}>{title}</span>
            <button type="button" aria-label="Back to full view" title="Back to full view" onClick={() => setMode('drawer')}><IconMaximize size={14} /></button>
            <button type="button" aria-label="Open in browser" title="Open in browser" onClick={() => void openExternal(b.url)}><IconExternal size={14} /></button>
            <button type="button" aria-label="Close player" title="Close" onClick={onClose}><IconClose size={14} /></button>
          </div>
        )}
        <iframe
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // YouTube's player refuses to start without a referrer (error 153).
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </>
  );
}
