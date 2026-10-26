import { useState } from 'react';
import { FEED_CATALOG, type CatalogFeed } from '../lib/feed-catalog';
import { isTauri } from '../lib/storage';
import { errorText, useRss, useRssStore, useToast } from '../state';
import { Dialog } from './Dialog';

/** Well-known feeds by category; following one files it under that category. */
export function FeedCatalogDialog({ onClose, onFollowed }: { onClose: () => void; onFollowed: (category: string) => void }) {
  const store = useRssStore();
  useRss(); // re-render as feeds are followed
  const toast = useToast();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Map<string, string>>(new Map());

  const followAll = async (category: string, feeds: CatalogFeed[]) => {
    const todo = feeds.filter((f) => !store.isFollowing(f.url) && !busy.has(f.url));
    if (!todo.length) return;
    onFollowed(category);
    setBusy((b) => new Set([...b, ...todo.map((f) => f.url)]));
    let ok = 0;
    await Promise.all(
      todo.map(async (f) => {
        try {
          await store.follow(f.url, category);
          ok++;
        } catch (e) {
          setFailed((m) => new Map(m).set(f.url, errorText(e)));
        } finally {
          setBusy((b) => {
            const next = new Set(b);
            next.delete(f.url);
            return next;
          });
        }
      }),
    );
    toast({ text: `Following ${ok} feed${ok === 1 ? '' : 's'} in ${category}${ok < todo.length ? `; ${todo.length - ok} couldn’t be read` : ''}.` });
  };

  return (
    <Dialog title="Discover feeds" onClose={onClose} variant="wide" footer={<button type="button" className="btn" onClick={onClose}>Done</button>}>
      <div className="dialog-body" style={{ gap: 18 }}>
        {!isTauri() && <span className="hint">Feeds are read in the desktop app only.</span>}
        {FEED_CATALOG.map(({ category, feeds }) => {
          const left = feeds.filter((f) => !store.isFollowing(f.url)).length;
          return (
            <section key={category} className="catalog-cat">
              <div className="catalog-head">
                <h3>{category}</h3>
                <button type="button" className="btn btn-sm" disabled={!left || !isTauri()} onClick={() => void followAll(category, feeds)}>
                  {left ? `Follow all ${left}` : 'Following all'}
                </button>
              </div>
              <div className="catalog-list">
                {feeds.map((f) => {
                  const following = store.isFollowing(f.url);
                  const error = failed.get(f.url);
                  return (
                    <div key={f.url} className="catalog-item">
                      <span className="grow">
                        <b>{f.title}</b>
                        <span className={error ? 'error' : 'hint'} style={{ display: 'block' }}>{error ? `Couldn’t read it: ${error}` : f.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      </span>
                      <button type="button" className="btn btn-sm" disabled={following || busy.has(f.url) || !isTauri()} onClick={() => void followAll(category, [f])}>
                        {following ? 'Following' : busy.has(f.url) ? 'Adding…' : 'Follow'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
