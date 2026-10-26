import { Header } from './components/Header';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { useState } from 'react';
import type { Shell } from './state';

/** A tab kept for movies and TV shows; what it holds is still to be decided. */
export function MediaView({ shell }: { shell: Shell }) {
  const [help, setHelp] = useState(false);
  const { theme, setThemePref } = shell;
  return (
    <div className="app">
      <Header
        mode="media"
        setMode={shell.setMode}
        theme={theme}
        toggleTheme={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}
        onQuickAdd={async () => false}
        onAddMany={() => {}}
        onHelp={() => setHelp(true)}
      />
      <main className="main">
        <div className="empty">
          <h2>Movies &amp; TV shows</h2>
          <span>This space is kept for movies and TV shows. Tell me what you’d like to keep here, such as a watchlist, ratings or where to stream, and I’ll build it.</span>
        </div>
      </main>
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </div>
  );
}
