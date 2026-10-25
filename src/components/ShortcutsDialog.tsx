import { Dialog } from './Dialog';

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Ctrl', 'L'], action: 'Paste a link (focus the add box)' },
  { keys: ['Ctrl', 'Shift', 'N'], action: 'Add many links' },
  { keys: ['Ctrl', 'F'], action: 'Search' },
  { keys: ['/'], action: 'Search' },
  { keys: ['Ctrl', 'I'], action: 'Import / Export' },
  { keys: ['Ctrl', ','], action: 'Settings' },
  { keys: ['Ctrl', 'M'], action: 'Manage categories and tags' },
  { keys: ['Ctrl', 'Shift', 'F'], action: 'Show or hide filters' },
  { keys: ['Ctrl', 'H'], action: 'Library / History' },
  { keys: ['Ctrl', 'D'], action: 'Light / dark mode' },
  { keys: ['Ctrl', 'Shift', 'C'], action: 'Comfortable / compact cards' },
  { keys: ['Ctrl', 'A'], action: 'Select all shown bookmarks' },
  { keys: ['Delete'], action: 'Delete selected bookmarks (with Undo)' },
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
