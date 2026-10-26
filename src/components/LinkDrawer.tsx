import { useEffect, useId, useRef, useState } from 'react';
import { FLAG_LABELS, LINK_FLAGS, type Link } from '../lib/link-types';
import { linkTitle } from '../lib/link-view';
import { closeChannelView, moveChannelView, openExternal, showChannelView, webViewNav } from '../lib/platform';
import { isTauri } from '../lib/storage';
import { errorText, useEscape, useLinkStore, useToast } from '../state';
import { IconBack, IconClose, IconCopy, IconExternal, IconForward, IconRefresh } from './Icons';
import { SiteIcon } from './LinkCard';

/**
 * Opens a saved link inside the app, in a drawer covering 80% of the window. The desktop app
 * lays its own browser view over the drawer's body (most sites refuse to be framed in a page).
 */
export function LinkDrawer({ l, onClose }: { l: Link; onClose: () => void }) {
  const store = useLinkStore();
  const toast = useToast();
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const title = linkTitle(l);
  useEscape(onClose);

  // Opening counts as viewing: the link stops being New.
  useEffect(() => {
    void store.markOpened(l.id);
  }, [store, l.id]);

  useEffect(() => {
    const el = host.current;
    if (!el || !isTauri()) return;
    const rect = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    showChannelView(l.url, rect()).catch((e) => setError(errorText(e)));
    const follow = new ResizeObserver(() => void moveChannelView(rect()).catch(() => {}));
    follow.observe(el);
    return () => {
      follow.disconnect();
      void closeChannelView().catch(() => {});
    };
  }, [l.url]);

  const nav = (action: 'back' | 'forward' | 'reload') => void webViewNav(action).catch(() => {});
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(l.url);
      toast({ text: 'Link copied.' });
    } catch {
      toast({ text: 'Couldn’t copy the link.' });
    }
  };

  return (
    <div className="overlay right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog drawer viewer link-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="ld-bar">
          {isTauri() && (
            <>
              <button type="button" className="icon-btn sm" aria-label="Back" title="Back" onClick={() => nav('back')}><IconBack /></button>
              <button type="button" className="icon-btn sm" aria-label="Forward" title="Forward" onClick={() => nav('forward')}><IconForward /></button>
              <button type="button" className="icon-btn sm" aria-label="Reload" title="Reload" onClick={() => nav('reload')}><IconRefresh size={15} /></button>
            </>
          )}
          <SiteIcon link={l} size={22} />
          <span className="ld-title">
            <b id={id} title={title}>{title}</b>
            <span className="hint" title={l.url}>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </span>
          <div className="ld-flags" role="group" aria-label="Status">
            <button type="button" className="flag-btn viewed" aria-pressed={l.viewed} onClick={() => void store.setViewed([l.id], !l.viewed)}>Viewed</button>
            {LINK_FLAGS.map((f) => (
              <button type="button" key={f} className={`flag-btn ${f}`} aria-pressed={l.flags.includes(f)} onClick={() => void store.setFlag([l.id], f, !l.flags.includes(f))}>{FLAG_LABELS[f]}</button>
            ))}
          </div>
          <button type="button" className="btn btn-sm" onClick={copy}><IconCopy size={14} />Copy link</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void openExternal(l.url)}><IconExternal size={14} />Open in browser</button>
          <button type="button" className="icon-btn sm" aria-label="Close" title="Close (Esc)" onClick={onClose}><IconClose /></button>
        </div>
        <div className="channel-host" ref={host}>
          {!isTauri() ? (
            <span className="ld-note">Pages open here in the desktop app. In this preview, use Open in browser.</span>
          ) : error ? (
            <span className="error">Couldn’t open the page here: {error}</span>
          ) : (
            <span>Loading {l.domain}…</span>
          )}
        </div>
      </section>
    </div>
  );
}
