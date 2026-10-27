import { Header } from './components/Header';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { useState } from 'react';
import type { PlaceholderMode, Shell } from './state';

const TEXT: Record<PlaceholderMode, { title: string; body: string }> = {
  movies: { title: 'Movies', body: 'This space is kept for movies, such as a watchlist, ratings or where to stream.' },
  tv: { title: 'TV shows', body: 'This space is kept for TV shows, such as what you’re watching, seasons and episodes.' },
  books: { title: 'Books', body: 'This space is kept for books, such as what you’re reading, want to read and have finished.' },
  games: { title: 'Games', body: 'This space is kept for games, such as your backlog, what you’re playing and what you’ve finished.' },
};

/** A tab kept for later; what it holds is still to be decided. */
export function MediaView({ shell, kind }: { shell: Shell; kind: PlaceholderMode }) {
  const [help, setHelp] = useState(false);
  const { theme, setThemePref } = shell;
  return (
    <div className="app">
      <Header
        mode={kind}
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={async () => false}
        onAddMany={() => {}}
        onHelp={() => setHelp(true)}
      />
      <main className="main">
        <div className="empty">
          <h2>{TEXT[kind].title}</h2>
          <span>{TEXT[kind].body} Coming soon.</span>
        </div>
      </main>
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </div>
  );
}
