import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { closeChannelView, moveChannelView, openExternal, showChannelView, webViewNav } from '../lib/platform';
import { isTauri } from '../lib/storage';
import { errorText, useEscape, useToast } from '../state';
import { IconBack, IconClose, IconCopy, IconExternal, IconForward, IconRefresh } from './Icons';

interface Props {
  url: string;
  title: string;
  icon?: ReactNode;
  /** Buttons shown between the title and Copy link. */
  extras?: ReactNode;
  onClose: () => void;
}

/**
 * Opens a web page inside the app, in a drawer covering 80% of the window. The desktop app
 * lays its own browser view over the drawer's body (most sites refuse to be framed in a page).
 */
export function WebDrawer({ url, title, icon, extras, onClose }: Props) {
  const toast = useToast();
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEscape(onClose);

  useEffect(() => {
    const el = host.current;
    if (!el || !isTauri()) return;
    setError('');
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

  const nav = (action: 'back' | 'forward' | 'reload') => void webViewNav(action).catch(() => {});
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ text: 'Link copied.' });
    } catch {
      toast({ text: 'Couldn’t copy the link.' });
    }
  };
  let site = '';
  try {
    site = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    site = url;
  }

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
          {icon}
          <span className="ld-title">
            <b id={id} title={title}>{title}</b>
            <span className="hint" title={url}>{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </span>
          {extras}
          <button type="button" className="btn btn-sm" onClick={copy}><IconCopy size={14} />Copy link</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void openExternal(url)}><IconExternal size={14} />Open in browser</button>
          <button type="button" className="icon-btn sm" aria-label="Close" title="Close (Esc)" onClick={onClose}><IconClose /></button>
        </div>
        <div className="channel-host" ref={host}>
          {!isTauri() ? (
            <span className="ld-note">Pages open here in the desktop app. In this preview, use Open in browser.</span>
          ) : error ? (
            <span className="error">Couldn’t open the page here: {error}</span>
          ) : (
            <span>Loading {site}…</span>
          )}
        </div>
      </section>
    </div>
  );
}
