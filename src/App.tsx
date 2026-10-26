import { useCallback, useEffect, useMemo, useState } from 'react';
import { VideoPlayer, type PlayerMode } from './components/VideoPlayer';
import { LinksView } from './LinksView';
import { MediaView } from './MediaView';
import { RssView } from './RssView';
import type { Bookmark } from './lib/types';
import { MODES, useLibrary, usePref, useResolvedTheme, useStore, type Mode, type Shell, type ThemePref } from './state';
import { YouTubeView } from './YouTubeView';

/**
 * Switches between the tabs (YouTube, Links, Git, Wikipedia, RSS, Movies & TV), remembering the last one for the next launch.
 * The video player lives here so picture in picture keeps playing across the switch.
 */
export default function App() {
  const store = useStore();
  const lib = useLibrary();
  const [savedMode, setMode] = usePref<Mode>('mode', 'youtube');
  const mode = MODES.some((m) => m.id === savedMode) ? savedMode : 'youtube';
  const [themePref, setThemePref] = usePref<ThemePref>('theme', 'system');
  const theme = useResolvedTheme(themePref);
  const [playing, setPlaying] = useState<{ id: string; mode: PlayerMode } | null>(null);
  const play = useCallback((id: string) => setPlaying({ id, mode: 'drawer' }), []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= MODES.length) {
        e.preventDefault();
        setMode(MODES[n - 1].id);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [setMode]);

  const shell = useMemo<Shell>(() => ({ mode, setMode, theme, themePref, setThemePref, play }), [mode, setMode, theme, themePref, setThemePref, play]);
  const onToggleWatched = useCallback((b: Bookmark) => void store.setWatched([b.id], !b.watched), [store]);
  const played = playing ? lib.bookmarks.find((b) => b.id === playing.id) : undefined;

  return (
    <>
      {mode === 'youtube' ? (
        <YouTubeView shell={shell} />
      ) : mode === 'rss' ? (
        <RssView shell={shell} />
      ) : mode === 'media' ? (
        <MediaView shell={shell} />
      ) : (
        <LinksView key={mode} shell={shell} section={mode} />
      )}
      {played && playing && (
        <VideoPlayer
          key={played.id}
          b={played}
          mode={playing.mode}
          setMode={(m) => setPlaying({ id: played.id, mode: m })}
          onClose={() => setPlaying(null)}
          onToggleWatched={onToggleWatched}
        />
      )}
    </>
  );
}
