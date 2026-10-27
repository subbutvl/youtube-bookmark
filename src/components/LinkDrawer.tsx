import { useEffect } from 'react';
import { FLAG_LABELS, LINK_FLAGS, type Link } from '../lib/link-types';
import { linkTitle } from '../lib/link-view';
import { useLinkStore } from '../state';
import { SiteIcon } from './LinkCard';
import { WebDrawer } from './WebDrawer';

/** Opens a saved link inside the app, with its Viewed mark and flags at hand. */
export function LinkDrawer({ l, onClose }: { l: Link; onClose: () => void }) {
  const store = useLinkStore();

  // Opening counts as viewing: the link stops being New.
  useEffect(() => {
    void store.markOpened(l.id);
  }, [store, l.id]);

  return (
    <WebDrawer
      url={l.url}
      title={linkTitle(l)}
      icon={<SiteIcon link={l} size={22} />}
      onClose={onClose}
      extras={
        <div className="ld-flags" role="group" aria-label="Status">
          <button type="button" className="flag-btn viewed" aria-pressed={l.viewed} onClick={() => void store.setViewed([l.id], !l.viewed)}>Viewed</button>
          {LINK_FLAGS.map((f) => (
            <button type="button" key={f} className={`flag-btn ${f}`} aria-pressed={l.flags.includes(f)} onClick={() => void store.setFlag([l.id], f, !l.flags.includes(f))}>{FLAG_LABELS[f]}</button>
          ))}
        </div>
      }
    />
  );
}
