import { useEffect, useId, useRef, useState } from 'react';
import { wikiTitleFromUrl } from '../lib/game-sources';
import { parseLink } from '../lib/link-url';
import { openExternal } from '../lib/platform';
import type { ReadCandidate } from '../lib/read-store';
import {
  ADAPTATION_LABELS, blankRead, goodreadsLink, MAGAZINE_CATEGORIES, READ_NOUN, READ_STATUS_LABELS,
  type AdaptationType, type ReadItem, type ReadKind, type ReadStatus,
} from '../lib/read-types';
import { errorText, useEscape, useReadStore, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconClose, IconEdit, IconExternal, IconPlus, IconRefresh, IconSearch, IconTrash } from './Icons';
import { Poster } from './MediaDialogs';

const ADD_TITLE: Record<ReadKind, string> = { book: 'Add a book', comic: 'Add a comic', magazine: 'Add a magazine' };

interface AddProps {
  kind: ReadKind;
  initialText: string;
  onClose: () => void;
  onAdded: (item: ReadItem, existed: boolean) => void;
  onManual: (draft: ReadItem) => void;
}

/** Search Wikipedia for a book, comic or magazine, then pick it; or add it by hand. */
export function ReadAddDialog({ kind, initialText, onClose, onAdded, onManual }: AddProps) {
  const store = useReadStore();
  const [text, setText] = useState(initialText);
  const [results, setResults] = useState<ReadCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState('');
  const [error, setError] = useState('');
  const asked = useRef('');
  const noun = READ_NOUN[kind];

  const run = async (q = text) => {
    const t = q.trim();
    if (!t) return;
    asked.current = t;
    setBusy(true);
    setError('');
    try {
      const hits = await store.search(t, kind);
      if (asked.current === t) setResults(hits);
    } catch (e) {
      if (asked.current === t) setError(`Couldn’t search: ${errorText(e)}`);
    } finally {
      if (asked.current === t) setBusy(false);
    }
  };

  useEffect(() => {
    if (text.trim()) void run();
    // Only the first text searches by itself; later searches wait for Enter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async (c: ReadCandidate) => {
    setAdding(c.title);
    setError('');
    try {
      const r = await store.addFromArticle(c.title, kind);
      onAdded(r.item, r.existed);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAdding('');
    }
  };

  const manual = () => {
    const t = text.trim();
    const link = parseLink(t);
    const wiki = link && /wikipedia\.org/.test(link.url) ? link.url : '';
    const goodreads = link && /goodreads\.com/.test(link.url) ? link.url : '';
    onManual(blankRead(kind, {
      title: wiki ? wikiTitleFromUrl(wiki).replace(/\s*\([^)]*\)\s*$/, '') : link ? '' : t,
      wikiUrl: wiki,
      goodreadsUrl: goodreads,
      officialUrl: link && !wiki && !goodreads ? link.url : '',
    }));
  };

  return (
    <Dialog
      title={ADD_TITLE[kind]}
      onClose={onClose}
      variant="wide"
      footer={
        <>
          <span className="hint">Details come from Wikipedia and Wikidata. Anything can be edited later.</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={manual}><IconPlus size={14} />Add by hand</button>
        </>
      }
    >
      <div className="dialog-body">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <div className="search" style={{ maxWidth: 'none' }}>
            <IconSearch />
            <label htmlFor="read-q" className="sr-only">Name or Wikipedia link</label>
            <input id="read-q" className="input" autoFocus placeholder={`The ${noun}’s name, or its Wikipedia link`} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <button type="submit" className="btn" disabled={!text.trim() || busy}>{busy ? 'Searching…' : 'Search'}</button>
        </form>
        {error && <div className="error">{error}</div>}
        {results && !results.length && !busy && <div className="hint">Nothing found on Wikipedia. Try another spelling, or add it by hand.</div>}
        {results && results.length > 0 && (
          <div className="list">
            {results.map((c) => (
              <div className="list-row" key={c.title}>
                <Poster url={c.thumbUrl} title={c.title} className="mthumb" />
                <span className="grow">
                  <b>{c.title}</b>
                  <span className="hint" style={{ display: 'block' }}>{c.description}</span>
                </span>
                <button type="button" className="btn btn-sm btn-primary" disabled={!!adding} onClick={() => void pick(c)}>{adding === c.title ? 'Adding…' : 'Add'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

const num = (s: string) => {
  const n = Number(s.trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};

/** Add a book, comic or magazine by hand, or change any of its details. */
export function ReadEditDialog({ item, isNew, onClose, onSaved }: { item: ReadItem; isNew: boolean; onClose: () => void; onSaved: (item: ReadItem) => void }) {
  const store = useReadStore();
  const [d, setD] = useState({
    title: item.title,
    originalTitle: item.originalTitle,
    authors: item.authors,
    year: item.year?.toString() ?? '',
    language: item.language,
    genres: item.genres.join(', '),
    category: item.category,
    publisher: item.publisher,
    wikiUrl: item.wikiUrl,
    goodreadsUrl: item.goodreadsUrl,
    officialUrl: item.officialUrl,
    coverUrl: item.coverUrl,
    summary: item.summary,
    synopsis: item.synopsis,
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const noun = READ_NOUN[item.kind];

  const link = (label: string, v: string, host?: RegExp): string | null => {
    if (!v.trim()) return '';
    const p = parseLink(v.trim());
    if (!p || (host && !host.test(new URL(p.url).hostname))) {
      setError(`The ${label} field takes a web link${host ? ` to ${label}` : ''}.`);
      return null;
    }
    return p.url;
  };

  const save = async () => {
    setError('');
    if (!d.title.trim()) return setError('A name is needed.');
    const wikiUrl = link('Wikipedia', d.wikiUrl, /(^|\.)wikipedia\.org$/);
    const goodreadsUrl = link('Goodreads', d.goodreadsUrl, /(^|\.)goodreads\.com$/);
    const officialUrl = link('official site', d.officialUrl);
    const coverUrl = link('cover image', d.coverUrl);
    if (wikiUrl == null || goodreadsUrl == null || officialUrl == null || coverUrl == null) return;
    const patch: Partial<ReadItem> = {
      title: d.title.trim(),
      originalTitle: d.originalTitle.trim(),
      authors: d.authors.trim(),
      year: num(d.year),
      language: d.language.trim(),
      genres: d.genres.split(',').map((g) => g.trim()).filter(Boolean),
      category: d.category.trim(),
      publisher: d.publisher.trim(),
      wikiUrl,
      goodreadsUrl,
      officialUrl,
      coverUrl,
      summary: d.summary.trim(),
      synopsis: d.synopsis.trim(),
    };
    try {
      if (isNew) {
        const r = await store.addManual({ ...item, ...patch });
        if (r.existed) return setError(`“${r.item.title}” is already saved.`);
        onSaved(r.item);
      } else {
        await store.update(item.id, patch);
        onSaved({ ...item, ...patch });
      }
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Dialog
      title={isNew ? `Add a ${noun} by hand` : `Edit “${item.title}”`}
      onClose={onClose}
      variant="wide"
      footer={
        <>
          {error && <span className="error">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>{isNew ? 'Add' : 'Save'}</button>
        </>
      }
    >
      <div className="dialog-body media-edit">
        <div className="media-edit-poster">
          <Poster url={d.coverUrl} title={d.title} className="mposter-lg" />
        </div>
        <div className="media-edit-fields">
          <label className="field">Name<input className="input" autoFocus value={d.title} onChange={set('title')} /></label>
          <div className="two-col">
            <label className="field">{item.kind === 'magazine' ? 'Editor or founder' : item.kind === 'comic' ? 'Writers and artists' : 'Author'}<input className="input" value={d.authors} onChange={set('authors')} placeholder="Comma separated" /></label>
            <label className="field">Title in its own language<input className="input" value={d.originalTitle} onChange={set('originalTitle')} placeholder="e.g. பொன்னியின் செல்வன்" /></label>
          </div>
          <div className="three-col">
            <label className="field">{item.kind === 'magazine' ? 'First published' : 'Year'}<input className="input" inputMode="numeric" value={d.year} onChange={set('year')} placeholder="e.g. 1955" /></label>
            <label className="field">Language<input className="input" value={d.language} onChange={set('language')} placeholder="e.g. English, Tamil" /></label>
            {item.kind === 'magazine' ? (
              <label className="field">Category
                <select className="select" value={d.category} onChange={set('category')}>
                  <option value="">Not set</option>
                  {d.category && !(MAGAZINE_CATEGORIES as readonly string[]).includes(d.category) && <option value={d.category}>{d.category}</option>}
                  {MAGAZINE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            ) : (
              <label className="field">Publisher<input className="input" value={d.publisher} onChange={set('publisher')} /></label>
            )}
          </div>
          {item.kind === 'magazine' && <label className="field">Publisher<input className="input" value={d.publisher} onChange={set('publisher')} /></label>}
          <label className="field">Genres<input className="input" value={d.genres} onChange={set('genres')} placeholder="Comma separated, e.g. Fantasy, Adventure" /></label>
          <div className="two-col">
            <label className="field">Wikipedia article<input className="input" value={d.wikiUrl} onChange={set('wikiUrl')} placeholder="https://en.wikipedia.org/wiki/…" /></label>
            <label className="field">Goodreads page<input className="input" value={d.goodreadsUrl} onChange={set('goodreadsUrl')} placeholder="https://www.goodreads.com/book/show/…" /></label>
            <label className="field">Official site<input className="input" value={d.officialUrl} onChange={set('officialUrl')} placeholder="https://…" /></label>
            <label className="field">Cover image<input className="input" value={d.coverUrl} onChange={set('coverUrl')} placeholder="Image link (optional)" /></label>
          </div>
          <label className="field">Summary<textarea className="textarea" rows={3} value={d.summary} onChange={set('summary')} /></label>
          {item.kind !== 'magazine' && <label className="field">Synopsis<textarea className="textarea" rows={5} value={d.synopsis} onChange={set('synopsis')} placeholder="What happens in it" /></label>}
          <span className="hint">These links stay here; they’re never added to the Links, YouTube or Wikipedia tabs.</span>
        </div>
      </div>
    </Dialog>
  );
}

const STATUSES: ReadStatus[] = ['want', 'reading', 'read', 'dropped'];
const AD_ORDER: AdaptationType[] = ['movie', 'tv', 'documentary', 'other'];

/** A book's, comic's or magazine's page: cover, details, status, synopsis, what it was made into, its links and notes. */
export function ReadDetail({ item, onClose, onEdit }: { item: ReadItem; onClose: () => void; onEdit: () => void }) {
  const store = useReadStore();
  const toast = useToast();
  const id = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [plot, setPlot] = useState<'idle' | 'looking' | 'none'>('idle');
  const [notes, setNotes] = useState(item.notes);
  const [link, setLink] = useState('');
  const [adTitle, setAdTitle] = useState('');
  const [adType, setAdType] = useState<AdaptationType>('movie');
  useEscape(onClose);
  const fetching = store.fetching.has(item.id);

  // The plot is read from the Wikipedia article the first time the page is opened.
  useEffect(() => {
    if (item.synopsis || !item.wikiUrl || !store.canFetch || item.kind === 'magazine') return;
    let live = true;
    setPlot('looking');
    store.fetchSynopsis(item.id).then(
      (t) => live && setPlot(t ? 'idle' : 'none'),
      () => live && setPlot('none'),
    );
    return () => {
      live = false;
    };
  }, [store, item.id, item.synopsis, item.wikiUrl, item.kind]);

  useEffect(() => setNotes(item.notes), [item.id, item.notes]);

  const patch = (p: Partial<ReadItem>) => void store.update(item.id, p).catch((e) => toast({ text: errorText(e) }));

  const addOwnLink = () => {
    const p = parseLink(link.trim());
    if (!p) return toast({ text: 'That isn’t a web link.' });
    if (!item.links.some((l) => l.url === p.url)) patch({ links: [...item.links, { label: new URL(p.url).hostname.replace(/^www\./, ''), url: p.url }] });
    setLink('');
  };

  const addAdaptation = () => {
    const t = adTitle.trim();
    if (!t) return;
    const m = t.match(/^(.*?)\s*\((\d{4})\)$/);
    patch({ adaptations: [...item.adaptations, { title: m ? m[1] : t, year: m ? Number(m[2]) : null, type: adType, wikiUrl: '' }] });
    setAdTitle('');
  };

  const gr = goodreadsLink(item);
  const meta = [item.authors, item.year != null ? (item.year < 0 ? `${-item.year} BCE` : item.year) : '', item.language, item.category, item.publisher].filter(Boolean);
  const rankNote = item.rank ? ` · #${item.rank} in the top ${item.kind === 'magazine' ? 150 : 1000}` : '';
  const shown = [
    item.wikiUrl && { label: 'Wikipedia', url: item.wikiUrl, found: true },
    item.kind !== 'magazine' && { label: gr.found ? 'Goodreads' : 'Find on Goodreads', url: gr.url, found: gr.found },
    item.officialUrl && { label: 'Official site', url: item.officialUrl, found: true },
  ].filter((x): x is { label: string; url: string; found: boolean } => !!x);

  return (
    <div className="overlay right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog drawer media-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <h2 id={id}>{item.title}</h2>
          <button type="button" className="icon-btn sm" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        <div className="dialog-body">
          <div className="md-top">
            <Poster url={item.coverUrl} title={item.title} className="mposter-lg" />
            <div className="md-info">
              {item.originalTitle && item.originalTitle !== item.title && <div className="md-original">{item.originalTitle}</div>}
              <div className="hint">{meta.join(' · ')}{rankNote}</div>
              {item.genres.length > 0 && <div className="chips">{item.genres.map((g) => <span className="chip muted" key={g}>{g}</span>)}</div>}
              <div className="md-scores">
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
                  <button type="button" key={s} aria-pressed={item.status === s} onClick={() => patch({ status: item.status === s ? 'none' : s })}>{READ_STATUS_LABELS[s]}</button>
                ))}
              </div>
              {item.summary ? <p className="md-synopsis">{item.summary}</p> : <p className="hint">{fetching ? 'Looking up details…' : 'No summary yet. Use Edit to write one.'}</p>}
              {item.metadataStatus === 'failed' && !fetching && <div className="note">Couldn’t find this on Wikipedia. Paste its Wikipedia link with Edit, then use Update details.</div>}
            </div>
          </div>

          {item.kind !== 'magazine' && (
            <section className="md-section">
              <h3>Synopsis</h3>
              {item.synopsis ? <p className="md-plot">{item.synopsis}</p> : <span className="hint">{plot === 'looking' ? 'Reading the plot from Wikipedia…' : item.wikiUrl ? 'Wikipedia’s article has no plot section. Use Edit to write one.' : 'No synopsis yet.'}</span>}
            </section>
          )}

          {item.kind !== 'magazine' && (
            <section className="md-section">
              <h3>Made into</h3>
              {item.adaptations.length ? (
                <div className="md-adaptations">
                  {AD_ORDER.filter((t) => item.adaptations.some((a) => a.type === t)).map((t) => (
                    <div key={t} className="md-adapt-group">
                      <span className="hint">{t === 'movie' ? 'Movies' : t === 'tv' ? 'TV shows' : t === 'documentary' ? 'Documentaries' : 'Other'}</span>
                      <div className="chips">
                        {item.adaptations.filter((a) => a.type === t).map((a, i) => (
                          <span className="chip" key={`${a.title}-${i}`}>
                            {a.wikiUrl ? (
                              <button type="button" className="btn-link" onClick={() => void openExternal(a.wikiUrl)} title={a.wikiUrl}>{a.title}{a.year ? ` (${a.year})` : ''}</button>
                            ) : (
                              <span>{a.title}{a.year ? ` (${a.year})` : ''}</span>
                            )}
                            <button type="button" className="icon-btn sm" aria-label={`Remove ${a.title}`} onClick={() => patch({ adaptations: item.adaptations.filter((x) => x !== a) })}><IconClose size={12} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="hint">{fetching ? 'Looking…' : 'No movie, TV show or documentary found for it.'}</span>
              )}
              <div className="md-inline">
                <input className="input grow" placeholder="Add one, e.g. The Godfather (1972)" value={adTitle} onChange={(e) => setAdTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAdaptation()} />
                <select className="select" value={adType} onChange={(e) => setAdType(e.target.value as AdaptationType)} aria-label="Kind">
                  {AD_ORDER.map((t) => <option key={t} value={t}>{ADAPTATION_LABELS[t]}</option>)}
                </select>
                <button type="button" className="btn btn-sm" disabled={!adTitle.trim()} onClick={addAdaptation}><IconPlus size={13} />Add</button>
              </div>
            </section>
          )}

          <section className="md-section">
            <h3>Links</h3>
            <div className="md-links">
              {shown.map((l) => (
                <span className={`chip${l.found ? '' : ' muted'}`} key={l.url}>
                  <button type="button" className="btn-link" onClick={() => void openExternal(l.url)} title={l.url}>{!l.found && <IconSearch size={12} />}{l.label}</button>
                </span>
              ))}
              {item.links.map((l) => (
                <span className="chip" key={l.url}>
                  <button type="button" className="btn-link" onClick={() => void openExternal(l.url)} title={l.url}>{l.label}</button>
                  <button type="button" className="icon-btn sm" aria-label={`Remove ${l.label}`} onClick={() => patch({ links: item.links.filter((x) => x.url !== l.url) })}><IconClose size={12} /></button>
                </span>
              ))}
            </div>
            <div className="md-inline">
              <input className="input grow" placeholder="Add a link (a review, an e-book, a reading guide…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwnLink()} />
              <button type="button" className="btn btn-sm" disabled={!link.trim()} onClick={addOwnLink}><IconPlus size={13} />Add</button>
            </div>
            <span className="hint">Links here belong to this {READ_NOUN[item.kind]} only. They aren’t added to the Links, YouTube or Wikipedia tabs.</span>
          </section>

          <section className="md-section">
            <h3>Notes</h3>
            <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== item.notes && patch({ notes })} placeholder="Where you are, favourite quotes, which edition you own…" />
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
          {item.wikiUrl && <button type="button" className="btn" onClick={() => void openExternal(item.wikiUrl)}><IconExternal size={14} />Wikipedia</button>}
          <button type="button" className="btn" disabled={!store.canFetch || fetching} onClick={() => void store.fetchDetails([item.id])}><IconRefresh size={14} />{fetching ? 'Updating…' : 'Update details'}</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}><IconEdit size={14} />Edit</button>
        </div>
      </section>
    </div>
  );
}
