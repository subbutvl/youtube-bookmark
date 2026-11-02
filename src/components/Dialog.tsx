import { useId, type ReactNode } from 'react';
import { useEscape } from '../state';
import { IconClose } from './Icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 'viewer' is a drawer covering 80% of the window, for watching. */
  variant?: 'normal' | 'wide' | 'drawer' | 'viewer';
}

export function Dialog({ title, onClose, children, footer, variant = 'normal' }: Props) {
  const id = useId();
  useEscape(onClose);
  return (
    <div className={`overlay${variant === 'drawer' || variant === 'viewer' ? ' right' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`dialog${variant === 'wide' ? ' wide' : ''}${variant === 'drawer' || variant === 'viewer' ? ' drawer' : ''}${variant === 'viewer' ? ' viewer' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="icon-btn sm" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        {children}
        {footer && <div className="dialog-foot">{footer}</div>}
      </section>
    </div>
  );
}

/** Text box that turns typed names into removable tag pills. */
export function TagInput({ value, onChange, suggestions, id }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[]; id?: string }) {
  const listId = useId();
  const add = (raw: string) => {
    const name = raw.trim().replace(/^#/, '');
    if (name && !value.some((v) => v.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <span className="tag-pill" key={t}>
          #{t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><IconClose size={12} /></button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        placeholder={value.length ? 'Add tag' : 'Type a tag, press Enter'}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if ((e.key === 'Enter' || e.key === ',') && el.value.trim()) {
            e.preventDefault();
            add(el.value);
            el.value = '';
          } else if (e.key === 'Backspace' && !el.value && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={(e) => {
          if (e.currentTarget.value.trim()) {
            add(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
      <datalist id={listId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
