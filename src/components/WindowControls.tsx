import { useEffect, useState } from 'react';
import { isTauri } from '../lib/storage';
import { minimizeToTrayEnabled } from '../state';

type Win = Awaited<ReturnType<typeof loadWindow>>;
const loadWindow = async () => (await import('@tauri-apps/api/window')).getCurrentWindow();

/** Minimize, maximize and close for the frameless desktop window. Hidden in the browser preview. */
export function WindowControls() {
  const [win, setWin] = useState<Win | null>(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void loadWindow().then(async (w) => {
      setWin(w);
      setMaximized(await w.isMaximized());
      unlisten = await w.onResized(async () => setMaximized(await w.isMaximized()));
    });
    return () => unlisten?.();
  }, []);

  if (!win) return null;
  const minimize = () => void (minimizeToTrayEnabled() ? win.hide() : win.minimize());
  return (
    <div className="win-controls">
      <button type="button" aria-label={minimizeToTrayEnabled() ? 'Minimize to tray' : 'Minimize'} title="Minimize" onClick={minimize}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" stroke="currentColor" /></svg>
      </button>
      <button type="button" aria-label={maximized ? 'Restore' : 'Maximize'} title={maximized ? 'Restore' : 'Maximize'} onClick={() => void win.toggleMaximize()}>
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor"><path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor"><path d="M.5.5h9v9h-9z" /></svg>
        )}
      </button>
      <button type="button" className="close" aria-label="Close" title="Close" onClick={() => void win.close()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" stroke="currentColor"><path d="M0 0l10 10M10 0L0 10" /></svg>
      </button>
    </div>
  );
}
