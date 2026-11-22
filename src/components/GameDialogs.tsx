import { useEffect, useId, useRef, useState } from 'react';
import { gameLinks, wikiTitleFromUrl } from '../lib/game-sources';
import type { GameCandidate } from '../lib/game-store';
import {
  blankGame, fmtHours, GAME_TYPES, GENRES, ORIGINS, originLabel, PLATFORMS, PLAY_LABELS, youtubeId,
  type Game, type GameType, type Genre, type Platform, type PlayStatus,
} from '../lib/game-types';
import { parseLink } from '../lib/link-url';
import { openExternal } from '../lib/platform';
import { errorText, useEscape, useGameStore, useToast } from '../state';
import { Dialog } from './Dialog';
import { IconClose, IconEdit, IconExternal, IconPlus, IconRefresh, IconSearch, IconTrash } from './Icons';
import { Poster } from './MediaDialogs';

/** Toggle buttons for a set of codes (platforms, genres, types). */
function Toggles<T extends string>({ all, value, onChange, label }: { all: Record<T, string>; value: T[]; onChange: (v: T[]) => void; label: string }) {
  return (
    <div className="chips game-toggles" role="group" aria-label={label}>
      {(Object.keys(all) as T[]).map((k) => (
        <button
          type="button"
          key={k}
          className="chip"
          aria-pressed={value.includes(k)}
          onClick={() => onChange(value.includes(k) ? value.filter((x) => x !== k) : (Object.keys(all) as T[]).filter((x) => x === k || value.includes(x)))}
        >
          {all[k]}
        </button>
      ))}
    </div>
  );
}

interface AddProps {
  initialText: string;
  onClose: () => void;
  onAdded: (game: Game, existed: boolean) => void;
  onManual: (draft: Game) => void;
}

/** Search Wikipedia for a game, then pick it; or add it by hand. */
export function GameAddDialog({ initialText, onClose, onAdded, onManual }: AddProps) {
  const store = useGameStore();
  const [text, setText] = useState(initialText);
  const [results, setResults] = useState<GameCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState('');
  const [error, setError] = useState('');
  const asked = useRef('');

  const run = async (q = text) => {
    const t = q.trim();
    if (!t) return;
    asked.current = t;
    setBusy(true);
    setError('');
    try {
      const hits = await store.search(t);
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

  const pick = async (c: GameCandidate) => {
    setAdding(c.title);
    setError('');
    try {
      const r = await store.addFromArticle(c.title);
      onAdded(r.game, r.existed);
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
    const yt = youtubeId(t);
    onManual(blankGame({
      title: wiki ? wikiTitleFromUrl(wiki).replace(/\s*\([^)]*\)\s*$/, '') : link || yt ? '' : t,
      wikiUrl: wiki,
      ignUrl: link && /(^|\.)ign\.com$/.test(new URL(link.url).hostname) ? link.url : '',
      officialUrl: link && !wiki && !yt && !/ign\.com/.test(link.url) ? link.url : '',
      trailerId: yt,
    }));
  };

  return (
    <Dialog
      title="Add a game"
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
            <label htmlFor="game-q" className="sr-only">Game name or Wikipedia link</label>
            <input id="game-q" className="input" autoFocus placeholder="Game name, or its Wikipedia link" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <button type="submit" className="btn" disabled={!text.trim() || busy}>{busy ? 'Searching…' : 'Search'}</button>
        </form>
        {error && <div className="error">{error}</div>}
        {results && !results.length && !busy && <div className="hint">No games found. Try another spelling, or add it by hand.</div>}
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

/** Add a game by hand, or change any of its details. */
export function GameEditDialog({ game, isNew, onClose, onSaved }: { game: Game; isNew: boolean; onClose: () => void; onSaved: (game: Game) => void }) {
  const store = useGameStore();
  const [d, setD] = useState({
    title: game.title,
    year: game.year?.toString() ?? '',
    hours: game.hours?.toString() ?? '',
    origin: game.origin,
    developer: game.developer,
    officialUrl: game.officialUrl,
    ignUrl: game.ignUrl,
    wikiUrl: game.wikiUrl,
    trailer: game.trailerId ? `https://www.youtube.com/watch?v=${game.trailerId}` : '',
    coverUrl: game.coverUrl,
    summary: game.summary,
  });
  const [platforms, setPlatforms] = useState<Platform[]>(game.platforms);
  const [genres, setGenres] = useState<Genre[]>(game.genres);
  const [types, setTypes] = useState<GameType[]>(game.types);
  const [error, setError] = useState('');
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

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
    const hours = num(d.hours);
    if (d.hours.trim() && (hours == null || hours < 0)) return setError('Play time is a number of hours (0 if it has no ending).');
    const officialUrl = link('official site', d.officialUrl);
    const ignUrl = link('IGN', d.ignUrl, /(^|\.)ign\.com$/);
    const wikiUrl = link('Wikipedia', d.wikiUrl, /(^|\.)wikipedia\.org$/);
    const coverUrl = link('cover image', d.coverUrl);
    if (officialUrl == null || ignUrl == null || wikiUrl == null || coverUrl == null) return;
    const trailerId = d.trailer.trim() ? youtubeId(d.trailer) : '';
    if (d.trailer.trim() && !trailerId) return setError('The trailer must be a YouTube video link.');
    const patch: Partial<Game> = {
      title: d.title.trim(),
      year: num(d.year),
      hours,
      origin: d.origin.trim().toUpperCase(),
      developer: d.developer.trim(),
      platforms,
      genres,
      types,
      officialUrl,
      ignUrl,
      wikiUrl,
      trailerId,
      coverUrl,
      summary: d.summary.trim(),
    };
    try {
      if (isNew) {
        const r = await store.addManual({ ...game, ...patch });
        if (r.existed) return setError(`“${r.game.title}” is already saved.`);
        onSaved(r.game);
      } else {
        await store.update(game.id, patch);
        onSaved({ ...game, ...patch });
      }
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Dialog
      title={isNew ? 'Add a game by hand' : `Edit “${game.title}”`}
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
          <Poster url={d.coverUrl} title={d.title} className="mposter-lg gcover" />
        </div>
        <div className="media-edit-fields">
          <label className="field">Name<input className="input" autoFocus value={d.title} onChange={set('title')} /></label>
          <div className="three-col">
            <label className="field">Year<input className="input" inputMode="numeric" value={d.year} onChange={set('year')} placeholder="e.g. 2015" /></label>
            <label className="field">Play time (hours)<input className="input" inputMode="decimal" value={d.hours} onChange={set('hours')} placeholder="0 = no ending" /></label>
            <label className="field">Origin
              <select className="select" value={d.origin} onChange={set('origin')}>
                <option value="">Not set</option>
                {d.origin && !ORIGINS[d.origin] && <option value={d.origin}>{d.origin}</option>}
                {Object.entries(ORIGINS).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Developer<input className="input" value={d.developer} onChange={set('developer')} placeholder="e.g. CD Projekt Red" /></label>
          <div className="field">Platforms<Toggles all={PLATFORMS} value={platforms} onChange={setPlatforms} label="Platforms" /></div>
          <div className="field">Genres<Toggles all={GENRES} value={genres} onChange={setGenres} label="Genres" /></div>
          <div className="field">Type<Toggles all={GAME_TYPES} value={types} onChange={setTypes} label="Type" /></div>
          <div className="two-col">
            <label className="field">Official site<input className="input" value={d.officialUrl} onChange={set('officialUrl')} placeholder="https://…" /></label>
            <label className="field">IGN page<input className="input" value={d.ignUrl} onChange={set('ignUrl')} placeholder="https://www.ign.com/games/…" /></label>
            <label className="field">Wikipedia article<input className="input" value={d.wikiUrl} onChange={set('wikiUrl')} placeholder="https://en.wikipedia.org/wiki/…" /></label>
            <label className="field">YouTube trailer<input className="input" value={d.trailer} onChange={set('trailer')} placeholder="https://www.youtube.com/watch?v=…" /></label>
          </div>
          <label className="field">Cover image<input className="input" value={d.coverUrl} onChange={set('coverUrl')} placeholder="Image link (optional)" /></label>
          <label className="field">Summary<textarea className="textarea" rows={4} value={d.summary} onChange={set('summary')} /></label>
          <span className="hint">These links stay with the game; they’re never added to the Links, YouTube or Wikipedia tabs.</span>
        </div>
      </div>
    </Dialog>
  );
}

const STATUSES: PlayStatus[] = ['want', 'playing', 'finished', 'dropped'];

/** A game's page: cover, details, status, trailer, its links and notes. */
export function GameDetail({ game, onClose, onEdit }: { game: Game; onClose: () => void; onEdit: () => void }) {
  const store = useGameStore();
  const toast = useToast();
  const id = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trailerState, setTrailerState] = useState<'idle' | 'looking' | 'none'>('idle');
  const [notes, setNotes] = useState(game.notes);
  const [link, setLink] = useState('');
  const [trailerInput, setTrailerInput] = useState('');
  useEscape(onClose);
  const fetching = store.fetching.has(game.id);

  // A trailer is looked for on YouTube the first time the page is opened.
  useEffect(() => {
    if (game.trailerId || !store.canFetch) return;
    let live = true;
    setTrailerState('looking');
    store.fetchTrailer(game.id).then(
      (t) => live && setTrailerState(t ? 'idle' : 'none'),
      () => live && setTrailerState('none'),
    );
    return () => {
      live = false;
    };
  }, [store, game.id, game.trailerId]);

  useEffect(() => setNotes(game.notes), [game.id, game.notes]);

  const patch = (p: Partial<Game>) => void store.update(game.id, p).catch((e) => toast({ text: errorText(e) }));

  const addOwnLink = () => {
    const p = parseLink(link.trim());
    if (!p) return toast({ text: 'That isn’t a web link.' });
    if (!game.links.some((l) => l.url === p.url)) patch({ links: [...game.links, { label: new URL(p.url).hostname.replace(/^www\./, ''), url: p.url }] });
    setLink('');
  };

  const setTrailer = () => {
    const t = youtubeId(trailerInput);
    if (!t) return toast({ text: 'Paste a YouTube video link.' });
    patch({ trailerId: t });
    setTrailerInput('');
  };

  const meta = [game.year, game.hours != null ? (game.hours === 0 ? 'No ending' : `About ${fmtHours(game.hours)} to finish`) : '', game.developer, game.origin ? originLabel(game.origin) : ''].filter(Boolean);
  const shown = gameLinks(game);

  return (
    <div className="overlay right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog drawer media-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <h2 id={id}>{game.title}</h2>
          <button type="button" className="icon-btn sm" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        <div className="dialog-body">
          <div className="md-top">
            <Poster url={game.coverUrl} title={game.title} className="mposter-lg gcover" />
            <div className="md-info">
              <div className="hint">{meta.join(' · ')}{game.rank ? ` · #${game.rank} in the top 500` : ''}</div>
              <div className="chips">
                {game.platforms.map((p) => <span className="chip" key={p}>{PLATFORMS[p]}</span>)}
                {game.genres.map((g) => <span className="chip muted" key={g}>{GENRES[g]}</span>)}
                {game.types.map((t) => <span className="chip muted" key={t}>{GAME_TYPES[t]}</span>)}
              </div>
              <div className="md-scores">
                <label className="score mine">
                  My rating
                  <select className="select" value={game.myRating ?? ''} onChange={(e) => patch({ myRating: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">–</option>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div className="seg" role="group" aria-label="Status">
                {STATUSES.map((s) => (
                  <button type="button" key={s} aria-pressed={game.status === s} onClick={() => patch({ status: game.status === s ? 'none' : s })}>{PLAY_LABELS[s]}</button>
                ))}
              </div>
              {game.summary ? <p className="md-synopsis">{game.summary}</p> : <p className="hint">{fetching ? 'Looking up details…' : 'No summary yet. Use Edit to write one.'}</p>}
              {game.metadataStatus === 'failed' && !fetching && <div className="note">Couldn’t find this game on Wikipedia. Fill in its links with Edit.</div>}
            </div>
          </div>

          <section className="md-section">
            <h3>Trailer</h3>
            {game.trailerId ? (
              <div className="md-trailer">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(game.trailerId)}?rel=0&playsinline=1`}
                  title={`${game.title} trailer`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <span className="hint">{trailerState === 'looking' ? 'Looking for a trailer on YouTube…' : 'No trailer found.'}</span>
            )}
            <div className="md-inline">
              <input className="input" placeholder={game.trailerId ? 'Wrong video? Paste another YouTube link' : 'Paste a YouTube link'} value={trailerInput} onChange={(e) => setTrailerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setTrailer()} />
              <button type="button" className="btn btn-sm" disabled={!trailerInput.trim()} onClick={setTrailer}>Use</button>
              <button type="button" className="btn btn-sm" onClick={() => void openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.title} ${game.year ?? ''} game trailer`)}`)}><IconSearch size={13} />Search YouTube</button>
              {game.trailerId && <button type="button" className="btn btn-sm" onClick={() => void openExternal(`https://www.youtube.com/watch?v=${game.trailerId}`)}><IconExternal size={13} />Open</button>}
            </div>
          </section>

          <section className="md-section">
            <h3>Links</h3>
            <div className="md-links">
              {shown.map((l) => (
                <span className={`chip${l.found ? '' : ' muted'}`} key={l.url}>
                  <button type="button" className="btn-link" onClick={() => void openExternal(l.url)} title={l.url}>{!l.found && <IconSearch size={12} />}{l.label}</button>
                </span>
              ))}
              {game.links.map((l) => (
                <span className="chip" key={l.url}>
                  <button type="button" className="btn-link" onClick={() => void openExternal(l.url)} title={l.url}>{l.label}</button>
                  <button type="button" className="icon-btn sm" aria-label={`Remove ${l.label}`} onClick={() => patch({ links: game.links.filter((x) => x.url !== l.url) })}><IconClose size={12} /></button>
                </span>
              ))}
            </div>
            <div className="md-inline">
              <input className="input grow" placeholder="Add a link (a guide, a review, a mod page…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwnLink()} />
              <button type="button" className="btn btn-sm" disabled={!link.trim()} onClick={addOwnLink}><IconPlus size={13} />Add</button>
            </div>
            <span className="hint">Links here belong to this game only. They aren’t added to the Links, YouTube or Wikipedia tabs.</span>
          </section>

          <section className="md-section">
            <h3>Notes</h3>
            <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== game.notes && patch({ notes })} placeholder="Where you left off, what platform you own it on…" />
          </section>
        </div>
        <div className="dialog-foot">
          <button
            type="button"
            className={`btn${confirmDelete ? ' btn-danger' : ''}`}
            onBlur={() => setConfirmDelete(false)}
            onClick={() => (confirmDelete ? void store.remove([game.id]).then(() => { toast({ text: `Deleted ${game.title}.` }); onClose(); }) : setConfirmDelete(true))}
          >
            <IconTrash size={14} />{confirmDelete ? 'Click again to delete' : 'Delete'}
          </button>
          <span className="spacer" />
          <button type="button" className="btn" disabled={!store.canFetch || fetching} onClick={() => void store.fetchDetails([game.id])}><IconRefresh size={14} />{fetching ? 'Updating…' : 'Update details'}</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}><IconEdit size={14} />Edit</button>
        </div>
      </section>
    </div>
  );
}
