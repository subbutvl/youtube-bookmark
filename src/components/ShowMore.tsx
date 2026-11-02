import { useEffect, useRef } from 'react';

/**
 * "Show more" for long lists: loads the next page by itself when scrolled into view,
 * and stays a button for keyboard users.
 */
export function ShowMore({ left, noun, onMore }: { left: number; noun: string; onMore: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const more = useRef(onMore);
  more.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more.current(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [left]);
  return (
    <button ref={ref} type="button" className="btn" style={{ alignSelf: 'center' }} onClick={onMore}>
      Show more ({left.toLocaleString()} {noun} left)
    </button>
  );
}
