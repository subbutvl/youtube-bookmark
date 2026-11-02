import { useEffect, useRef, useState } from 'react';
import { bestMatch } from '../lib/media-store';
import { linkLabel, parseMediaInput, type Candidate } from '../lib/media-sources';
import { blankItem, KIND_NOUN, type MediaItem, type MediaKind } from '../lib/media-types';
import { parseYouTubeUrl } from '../lib/youtube-url';
import { errorText, useMediaStore, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconPlus, IconSearch } from './Icons';

/** A small poster, or the first letter when there's none. */
export function Poster({ url, title, className = 'mthumb' }: { url: string; title: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return url && !broken ? (
    <img className={className} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  ) : (
    <span className={`${className} ph`} aria-hidden="true">{title.trim().charAt(0).toUpperCase() || '?'}</span>
  );
}

export const fmtVotes = (n: number | null) => (n == null ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

interface AddProps {
  kind: MediaKind;
  initialText: string;
  /** Set when choosing the right match for a title already saved. */
  relink?: MediaItem;
  onClose: () => void;
  onAdded: (item: MediaItem, existed: boolean) => void;
  onManual: (draft: MediaItem) => void;
}

/** Search by name or link, then pick the right result. Works for any language. */
export function MediaAddDialog({ kind, initialText, relink, onClose, onAdded, onManual }: AddProps) {
  const store = useMediaStore();
  const toast = useToast();
  const [text, setText] = useState(initialText || (relink ? `${relink.title}${relink.year ? ` ${relink.year}` : ''}` : ''));
  const [scope, setScope] = useState<'kind' | 'any'>('kind');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const asked = useRef('');
  const input = text.trim() ? parseMediaInput(text) : null;

  const run = async (q = text, sc = scope) => {
    const t = q.trim();
    if (!t) return;
    const parsed = parseMediaInput(t);
    if (parsed.kind === 'youtube' || parsed.kind === 'url') {
      setResults(null);
      return;
    }
    asked.current = t;
    setBusy(true);
    setError('');
    try {
      const hits = await store.search(t, sc === 'kind' ? kind : null);
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

  const pick = async (c: Candidate) => {
    try {
      if (relink) {
        await store.relink(relink.id, c);
        toast({ text: `Now showing details for ${c.title}${c.year ? ` (${c.year})` : ''}.` });
        onClose();
        return;
      }
      const link = input && (input.kind === 'wiki' || (input.kind === 'search' && input.url)) ? [{ label: linkLabel(input.url!), url: input.url! }] : [];
      const r = await store.addCandidate(c, { links: link });
      onAdded(r.item, r.existed);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const manual = () => {
    const p = input;
    const draft = blankItem(kind, {
      title: p?.kind === 'search' ? p.query : '',
      year: p?.kind === 'search' ? p.year : null,
      imdbId: p?.kind === 'imdb' ? p.imdbId : '',
      trailerId: p?.kind === 'youtube' ? p.videoId : '',
      links: p?.kind === 'url' || p?.kind === 'wiki' ? [{ label: linkLabel(p.url), url: p.url }] : [],
    });
    onManual(draft);
  };

  return (
    <Dialog
      title={relink ? `Find the right match for “${relink.title}”` : `Add a ${KIND_NOUN[kind]}`}
      onClose={onClose}
      variant="wide"
      footer={
        <>
          <span className="hint">Details come from JustWatch, IMDb and Wikipedia. Anything can be edited later.</span>
          <span className="spacer" />
          {!relink && <button type="button" className="btn" onClick={manual}><IconPlus size={14} />Add by hand</button>}
        </>
      }
    >
      <div className="dialog-body">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <div className="search" style={{ maxWidth: 'none' }}>
            <IconSearch />
            <label htmlFor="media-q" className="sr-only">Name or link</label>
            <input id="media-q" className="input" autoFocus placeholder="Name in any language, or an IMDb, Wikipedia, JustWatch or Rotten Tomatoes link" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="seg" role="group" aria-label="Search in">
            <button type="button" aria-pressed={scope === 'kind'} onClick={() => { setScope('kind'); void run(text, 'kind'); }}>{kind === 'tv' ? 'TV shows' : 'Movies'}</button>
            <button type="button" aria-pressed={scope === 'any'} onClick={() => { setScope('any'); void run(text, 'any'); }}>Both</button>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Searching…' : 'Search'}</button>
        </form>
        {error && <div className="error">{error}</div>}
        {input?.kind === 'youtube' && (
          <div className="note">That’s a YouTube video. <button type="button" className="btn-link" onClick={manual}>Add the title by hand with this video as its trailer</button>, or type the name to search.</div>
        )}
        {input?.kind === 'url' && (
          <div className="note">This site can’t be read for movie details. <button type="button" className="btn-link" onClick={manual}>Add the title by hand with this link</button>, or type the name to search.</div>
        )}
        {results && !results.length && !busy && (
          <div className="note">Nothing found. Try the original-language name, add the year, or switch to “Both”. You can also add it by hand.</div>
        )}
        {results && results.length > 0 && (
          <div className="list media-results">
            {results.map((c, i) => {
              const saved = !relink && store.find(c);
              return (
                <div className="list-row" key={`${c.justwatchPath || c.imdbId || c.title}-${i}`}>
                  <Poster url={c.posterUrl} title={c.title} />
                  <div className="grow mres-text">
                    <b>{c.title}</b> {c.year && <span className="hint">({c.year})</span>} <span className="pill">{c.kind === 'tv' ? 'TV' : 'Movie'}</span>
                    {c.originalTitle && <div className="hint">{c.originalTitle}</div>}
                    <div className="hint">
                      {[c.imdbRating != null && `IMDb ${c.imdbRating}`, c.rtScore != null && `RT ${c.rtScore}%`, c.genres.slice(0, 3).join(', '), c.watch.length ? `On ${[...new Set(c.watch.map((w) => w.provider))].slice(0, 3).join(', ')}` : '', c.note].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {saved ? (
                    <button type="button" className="btn btn-sm" onClick={() => onAdded(saved, true)}>Saved · show</button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void pick(c)}>{relink ? 'Use this' : 'Add'}</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** Many names or links at once; each takes the best search match. */
export function MediaManyDialog({ kind, initialText, onClose }: { kind: MediaKind; initialText: string; onClose: () => void }) {
  const store = useMediaStore();
  const toast = useToast();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const go = async () => {
    setBusy({ done: 0, total: lines.length });
    setMissed([]);
    let added = 0;
    let existed = 0;
    const miss: string[] = [];
    for (const [i, line] of lines.entries()) {
      try {
        const p = parseMediaInput(line);
        if (p.kind === 'url' || p.kind === 'youtube') {
          miss.push(line);
          continue;
        }
        const hits = await store.search(line, p.kind === 'search' ? kind : null);
        const probe = p.kind === 'search' ? blankItem(kind, { title: p.query, year: p.year }) : null;
        const year = p.kind === 'search' ? p.year : null;
        const hit = probe ? bestMatch(hits, probe) ?? (year ? hits.find((h) => h.year === year) : hits[0]) : hits[0];
        if (!hit) {
          miss.push(line);
          continue;
        }
        const r = await store.addCandidate(hit, p.kind === 'wiki' ? { links: [{ label: 'Wikipedia', url: p.url }] } : {});
        if (r.existed) existed++;
        else added++;
      } catch {
        miss.push(line);
      } finally {
        setBusy({ done: i + 1, total: lines.length });
      }
    }
    setBusy(null);
    setMissed(miss);
    toast({ text: `Added ${added}${existed ? `, ${existed} already saved` : ''}${miss.length ? `, ${miss.length} not found` : ''}.` }, 8000);
    if (!miss.length) onClose();
    else setText(miss.join('\n'));
  };

  return (
    <Dialog
      title={`Add several ${kind === 'tv' ? 'TV shows' : 'movies'}`}
      onClose={onClose}
      footer={
        <>
          {busy && <span className="hint">Looking up {busy.done} of {busy.total}…</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" disabled={!lines.length || !!busy} onClick={() => void go()}>Add {lines.length || ''}</button>
        </>
      }
    >
      <div className="dialog-body">
        <label className="field">
          One per line: a name (with the year if you like, e.g. “Kantara 2022”), or an IMDb, Wikipedia or JustWatch link
          <textarea className="textarea" rows={12} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {missed.length > 0 && <div className="note">These weren’t found and are left in the box: try the original name or a link, or add them one at a time.</div>}
      </div>
    </Dialog>
  );
}

const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));

/** Every field by hand, for a new title or to correct one. */
export function MediaEditDialog({ item, isNew, onClose, onSaved }: { item: MediaItem; isNew: boolean; onClose: () => void; onSaved: (item: MediaItem) => void }) {
  const store = useMediaStore();
  const [d, setD] = useState({
    kind: item.kind,
    title: item.title,
    originalTitle: item.originalTitle,
    year: item.year?.toString() ?? '',
    language: item.language,
    posterUrl: item.posterUrl,
    synopsis: item.synopsis,
    imdb: item.imdbId,
    imdbRating: item.imdbRating?.toString() ?? '',
    rtScore: item.rtScore?.toString() ?? '',
    genres: item.genres.join(', '),
    length: (item.kind === 'tv' ? item.seasons : item.runtime)?.toString() ?? '',
    trailer: item.trailerId ? `https://www.youtube.com/watch?v=${item.trailerId}` : '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    if (!d.title.trim()) return setError('A name is needed.');
    const imdbId = d.imdb.match(/tt\d{6,10}/)?.[0] ?? '';
    if (d.imdb.trim() && !imdbId) return setError('The IMDb field takes a link like imdb.com/title/tt1375666 or the id tt1375666.');
    const yt = d.trailer.trim() ? parseYouTubeUrl(d.trailer.trim()) : null;
    if (d.trailer.trim() && (!yt || (yt.type !== 'video' && yt.type !== 'short'))) return setError('The trailer must be a YouTube video link.');
    const patch: Partial<MediaItem> = {
      kind: d.kind,
      title: d.title.trim(),
      originalTitle: d.originalTitle.trim(),
      year: num(d.year),
      language: d.language.trim(),
      posterUrl: d.posterUrl.trim(),
      synopsis: d.synopsis.trim(),
      imdbId,
      imdbRating: num(d.imdbRating),
      rtScore: num(d.rtScore),
      genres: d.genres.split(',').map((g) => g.trim()).filter(Boolean),
      runtime: d.kind === 'movie' ? num(d.length) : item.runtime,
      seasons: d.kind === 'tv' ? num(d.length) : item.seasons,
      trailerId: yt?.youtubeId ?? '',
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
      title={isNew ? 'Add by hand' : `Edit “${item.title}”`}
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
          <Poster url={d.posterUrl} title={d.title} className="mposter-lg" />
        </div>
        <div className="media-edit-fields">
          <div className="two-col">
            <label className="field">Name<input className="input" autoFocus value={d.title} onChange={set('title')} /></label>
            <label className="field">Name in its own language<input className="input" value={d.originalTitle} onChange={set('originalTitle')} placeholder="e.g. ಕಾಂತಾರ" /></label>
          </div>
          <div className="three-col">
            <label className="field">Type
              <select className="select" value={d.kind} onChange={(e) => setD((x) => ({ ...x, kind: e.target.value as MediaKind }))}>
                <option value="movie">Movie</option>
                <option value="tv">TV show</option>
              </select>
            </label>
            <label className="field">Year<input className="input" inputMode="numeric" value={d.year} onChange={set('year')} /></label>
            <label className="field">Language<input className="input" value={d.language} onChange={set('language')} placeholder="e.g. Tamil" /></label>
          </div>
          <label className="field">Poster image link<input className="input" value={d.posterUrl} onChange={set('posterUrl')} placeholder="https://…jpg" /></label>
          <label className="field">Synopsis<textarea className="textarea" rows={4} value={d.synopsis} onChange={set('synopsis')} /></label>
          <div className="three-col">
            <label className="field">IMDb link or id<input className="input" value={d.imdb} onChange={set('imdb')} placeholder="tt1375666" /></label>
            <label className="field">IMDb rating<input className="input" inputMode="decimal" value={d.imdbRating} onChange={set('imdbRating')} placeholder="out of 10" /></label>
            <label className="field">Rotten Tomatoes %<input className="input" inputMode="numeric" value={d.rtScore} onChange={set('rtScore')} /></label>
          </div>
          <div className="three-col">
            <label className="field">Genres<input className="input" value={d.genres} onChange={set('genres')} placeholder="Drama, Thriller" /></label>
            <label className="field">{d.kind === 'tv' ? 'Seasons' : 'Runtime (minutes)'}<input className="input" inputMode="numeric" value={d.length} onChange={set('length')} /></label>
            <label className="field">Trailer (YouTube link)<input className="input" value={d.trailer} onChange={set('trailer')} /></label>
          </div>
          <span className="hint">Where to watch, links and notes are edited on the title’s page.</span>
        </div>
      </div>
    </Dialog>
  );
}
