import { useEffect, useId, useState } from 'react';
import { addLink, linkLabel, standardLinks } from '../lib/media-sources';
import { COMMON_PROVIDERS, COUNTRIES, OFFER_LABELS, STATUS_LABELS, type MediaItem, type OfferType, type WatchStatus } from '../lib/media-types';
import { openExternal } from '../lib/platform';
import { parseLink } from '../lib/link-url';
import { errorText, mediaCountry, useEscape, useMediaStore, useToast } from '../state';
import { IconClose, IconEdit, IconExternal, IconPlus, IconRefresh, IconSearch, IconTrash } from './Icons';
import { fmtVotes, Poster } from './MediaDialogs';

interface Props {
  item: MediaItem;
  onClose: () => void;
  onEdit: () => void;
  onRelink: () => void;
}

const STATUSES: WatchStatus[] = ['want', 'watching', 'watched'];

/** A title's page: poster, ratings, synopsis, trailer, where to watch, links and notes. */
export function MediaDetail({ item, onClose, onEdit, onRelink }: Props) {
  const store = useMediaStore();
  const toast = useToast();
  const id = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trailerState, setTrailerState] = useState<'idle' | 'looking' | 'none'>('idle');
  const [notes, setNotes] = useState(item.notes);
  const [w, setW] = useState({ provider: '', url: '', type: 'stream' as OfferType });
  const [link, setLink] = useState('');
  const [trailerInput, setTrailerInput] = useState('');
  useEscape(onClose);
  const country = COUNTRIES.find((c) => c.code === mediaCountry())?.name ?? mediaCountry();
  const fetching = store.fetching.has(item.id);

  // A trailer is looked for on YouTube the first time the page is opened.
  useEffect(() => {
    if (item.trailerId || !store.canFetch) return;
    let live = true;
    setTrailerState('looking');
    store.fetchTrailer(item.id).then(
      (t) => live && setTrailerState(t ? 'idle' : 'none'),
      () => live && setTrailerState('none'),
    );
    return () => {
      live = false;
    };
  }, [store, item.id, item.trailerId]);

  useEffect(() => setNotes(item.notes), [item.id, item.notes]);

  const patch = (p: Partial<MediaItem>) => void store.update(item.id, p).catch((e) => toast({ text: errorText(e) }));

  const addWatch = () => {
    const provider = w.provider.trim();
    if (!provider) return;
    const url = w.url.trim() ? parseLink(w.url.trim())?.url : '';
    if (w.url.trim() && !url) return toast({ text: 'That isn’t a web link.' });
    patch({ watch: [...item.watch, { provider, url: url ?? '', type: w.type, manual: true }] });
    setW({ provider: '', url: '', type: w.type });
  };

  const addOwnLink = () => {
    const p = parseLink(link.trim());
    if (!p) return toast({ text: 'That isn’t a web link.' });
    patch({ links: addLink(item.links, { label: linkLabel(p.url), url: p.url }) });
    setLink('');
  };

  const setTrailer = () => {
    const m = trailerInput.trim().match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
    if (!m) return toast({ text: 'Paste a YouTube video link.' });
    patch({ trailerId: m[1] });
    setTrailerInput('');
  };

  const meta = [
    item.year,
    item.kind === 'tv' ? (item.seasons ? `${item.seasons} season${item.seasons === 1 ? '' : 's'}` : 'TV show') : item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : 'Movie',
    item.language,
    item.genres.join(', '),
  ].filter(Boolean);
  const links = [...standardLinks(item), ...item.links.filter((l) => !standardLinks(item).some((s) => s.url === l.url))];
  const shownWatch = [...item.watch].sort((a, b) => Number(b.manual) - Number(a.manual));

  return (
    <div className="overlay right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog drawer media-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <h2 id={id}>{item.title}</h2>
          <button type="button" className="icon-btn sm" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        <div className="dialog-body">
          <div className="md-top">
            <Poster url={item.posterUrl} title={item.title} className="mposter-lg" />
            <div className="md-info">
              {item.originalTitle && <div className="md-original">{item.originalTitle}</div>}
              <div className="hint">{meta.join(' · ')}</div>
              <div className="md-scores">
                {item.imdbRating != null && <span className="score imdb" title={item.imdbVotes ? `${item.imdbVotes.toLocaleString()} votes` : undefined}>IMDb <b>{item.imdbRating.toFixed(1)}</b>{item.imdbVotes ? <span className="hint"> ({fmtVotes(item.imdbVotes)})</span> : null}</span>}
                {item.rtScore != null && <span className="score rt">Rotten Tomatoes <b>{item.rtScore}%</b></span>}
                <label className="score mine">
                  My rating
                  <select className="select" value={item.myRating ?? ''} onChange={(e) => patch({ myRating: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">–</option>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div className="seg" role="group" aria-label="Status">
                {STATUSES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    aria-pressed={item.status === s}
                    onClick={() => (s === 'watched' && item.status !== 'watched' && !item.watchCount ? void store.addWatch(item.id) : patch({ status: item.status === s ? 'none' : s }))}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="md-watches">
                <span>
                  {item.watchCount ? <>Watched <b>{item.watchCount}</b> time{item.watchCount === 1 ? '' : 's'}</> : 'Not watched yet'}
                  {item.lastWatchedAt && <span className="hint"> · last {new Date(item.lastWatchedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </span>
                <button type="button" className="icon-btn sm" aria-label="One less" title="One less" disabled={!item.watchCount} onClick={() => void store.setWatchCount(item.id, item.watchCount - 1)}>−</button>
                <button type="button" className="btn btn-sm" onClick={() => void store.addWatch(item.id)}>{item.watchCount ? '+1 Watched again' : '+1 Watched'}</button>
              </div>
              {item.synopsis ? <p className="md-synopsis">{item.synopsis}</p> : <p className="hint">{fetching ? 'Looking up details…' : 'No synopsis yet. Use Edit to write one.'}</p>}
              {item.metadataStatus === 'failed' && !fetching && (
                <div className="note">Couldn’t find this title automatically. <button type="button" className="btn-link" onClick={onRelink}>Search for it</button> or fill it in with Edit.</div>
              )}
            </div>
          </div>

          <section className="md-section">
            <h3>Trailer</h3>
            {item.trailerId ? (
              <div className="md-trailer">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.trailerId)}?rel=0&playsinline=1`}
                  title={`${item.title} trailer`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <span className="hint">{trailerState === 'looking' ? 'Looking for a trailer on YouTube…' : 'No trailer found.'}</span>
            )}
            <div className="md-inline">
              <input className="input" placeholder={item.trailerId ? 'Wrong video? Paste another YouTube link' : 'Paste a YouTube link'} value={trailerInput} onChange={(e) => setTrailerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setTrailer()} />
              <button type="button" className="btn btn-sm" disabled={!trailerInput.trim()} onClick={setTrailer}>Use</button>
              <button type="button" className="btn btn-sm" onClick={() => void openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} ${item.year ?? ''} trailer`)}`)}><IconSearch size={13} />Search YouTube</button>
              {item.trailerId && <button type="button" className="btn btn-sm" onClick={() => void openExternal(`https://www.youtube.com/watch?v=${item.trailerId}`)}><IconExternal size={13} />Open</button>}
            </div>
          </section>

          <section className="md-section">
            <h3>Where to watch <span className="hint">({country})</span></h3>
            {shownWatch.length ? (
              <div className="list">
                {shownWatch.map((o, i) => (
                  <div className="list-row" key={`${o.provider}-${o.type}-${i}`}>
                    <b className="grow">{o.provider} <span className="hint">· {OFFER_LABELS[o.type]}{o.manual ? ' · added by you' : ''}</span></b>
                    {o.url && <button type="button" className="btn btn-sm" onClick={() => void openExternal(o.url)}><IconExternal size={13} />Open</button>}
                    <button type="button" className="icon-btn sm" aria-label={`Remove ${o.provider}`} title="Remove" onClick={() => patch({ watch: item.watch.filter((x) => x !== o) })}><IconClose size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="hint">{fetching ? 'Looking…' : `No platforms found for ${country}. Add where you watch it below.`}</span>
            )}
            <div className="md-inline">
              <input className="input" list="ott-providers" placeholder="Platform, e.g. Prime Video" value={w.provider} onChange={(e) => setW({ ...w, provider: e.target.value })} />
              <datalist id="ott-providers">{COMMON_PROVIDERS.map((p) => <option key={p} value={p} />)}</datalist>
              <input className="input grow" placeholder="Link to the title on it (optional)" value={w.url} onChange={(e) => setW({ ...w, url: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addWatch()} />
              <select className="select" aria-label="Offer" value={w.type} onChange={(e) => setW({ ...w, type: e.target.value as OfferType })}>
                {(Object.keys(OFFER_LABELS) as OfferType[]).map((t) => <option key={t} value={t}>{OFFER_LABELS[t]}</option>)}
              </select>
              <button type="button" className="btn btn-sm" disabled={!w.provider.trim()} onClick={addWatch}><IconPlus size={13} />Add</button>
            </div>
          </section>

          <section className="md-section">
            <h3>Links</h3>
            <div className="md-links">
              {links.map((l) => (
                <span className="chip" key={l.url}>
                  <button type="button" className="btn-link" onClick={() => void openExternal(l.url)} title={l.url}>{l.label}</button>
                  {item.links.some((x) => x.url === l.url) && (
                    <button type="button" className="icon-btn sm" aria-label={`Remove ${l.label}`} onClick={() => patch({ links: item.links.filter((x) => x.url !== l.url) })}><IconClose size={12} /></button>
                  )}
                </span>
              ))}
            </div>
            <div className="md-inline">
              <input className="input grow" placeholder="Add a link (a review, an article, a fan page…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwnLink()} />
              <button type="button" className="btn btn-sm" disabled={!link.trim()} onClick={addOwnLink}><IconPlus size={13} />Add</button>
            </div>
          </section>

          <section className="md-section">
            <h3>Notes</h3>
            <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== item.notes && patch({ notes })} placeholder="Who recommended it, which season you’re on…" />
          </section>
        </div>
        <div className="dialog-foot">
          <button
            type="button"
            className={`btn${confirmDelete ? ' btn-danger' : ''}`}
            onBlur={() => setConfirmDelete(false)}
            onClick={() => (confirmDelete ? void store.remove([item.id]).then(() => { toast({ text: `Deleted ${item.title}.` }); onClose(); }) : setConfirmDelete(true))}
          >
            <IconTrash size={14} />{confirmDelete ? 'Click again to delete' : 'Delete'}
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onRelink} title="Pick the right title if the details belong to a different one">Wrong title?</button>
          <button type="button" className="btn" disabled={!store.canFetch || fetching} onClick={() => void store.fetchDetails([item.id])}><IconRefresh size={14} />{fetching ? 'Updating…' : 'Update details'}</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}><IconEdit size={14} />Edit</button>
        </div>
      </section>
    </div>
  );
}
