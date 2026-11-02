import { Dialog } from './Dialog';

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Ctrl', '1…9'], action: 'Tabs: YouTube, Links, Git, Wikipedia, RSS, Movies, TV Shows, Books, Games' },
  { keys: ['Ctrl', 'L'], action: 'Paste a link (focus the add box)' },
  { keys: ['Ctrl', 'Shift', 'N'], action: 'Add many links' },
  { keys: ['Ctrl', 'F'], action: 'Search' },
  { keys: ['/'], action: 'Search' },
  { keys: ['Ctrl', 'I'], action: 'Import' },
  { keys: ['Ctrl', 'E'], action: 'Export' },
  { keys: ['Ctrl', ','], action: 'Settings' },
  { keys: ['Ctrl', 'M'], action: 'Manage categories and tags' },
  { keys: ['Ctrl', 'Shift', 'F'], action: 'Show or hide filters' },
  { keys: ['Ctrl', 'H'], action: 'Library / History (YouTube)' },
  { keys: ['Ctrl', 'Shift', 'T'], action: 'Cards / table (Links)' },
  { keys: ['Ctrl', 'Shift', 'G'], action: 'Group by site on or off (Links)' },
  { keys: ['Ctrl', 'G'], action: 'Group the selected links' },
  { keys: ['R'], action: 'Refresh feeds (RSS)' },
  { keys: ['J', 'K'], action: 'Next / previous article (RSS)' },
  { keys: ['Ctrl', 'D'], action: 'Light / dark mode' },
  { keys: ['Ctrl', 'Shift', 'C'], action: 'Comfortable / compact cards' },
  { keys: ['Ctrl', 'A'], action: 'Select everything shown' },
  { keys: ['Delete'], action: 'Delete the selection (with Undo)' },
  { keys: ['Esc'], action: 'Close a dialog, clear search or selection' },
  { keys: ['?'], action: 'This list' },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>Done</button>}>
      <div className="dialog-body">
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys.join('+') + s.action}>
                <td>{s.keys.map((k, i) => <span key={k}>{i > 0 && '+'}<kbd>{k}</kbd></span>)}</td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
