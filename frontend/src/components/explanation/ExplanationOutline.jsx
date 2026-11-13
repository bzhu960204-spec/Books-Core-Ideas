import { useCallback, useEffect, useRef, useState } from 'react';
import { OUTLINE_SELECTOR, activeEntryIndex } from '../../utils/explanationOutline';

// Floating outline of the explanation being read: its headings, with the one being
// read marked. Clicking an entry scrolls to it and closes the panel. It overlays the
// text instead of taking a column, and never touches the rendered content.
// Buttons marked `data-outline-toggle` are left to open/close it themselves.
export default function ExplanationOutline({ entries, contentRef, bodyRef, onClose }) {
  const [active, setActive] = useState(0);
  const panelRef = useRef(null);

  const headings = useCallback(
    () => Array.from(contentRef.current?.querySelectorAll(OUTLINE_SELECTOR) ?? []),
    [contentRef],
  );

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const update = () => {
      const found = headings();
      const bodyTop = body.getBoundingClientRect().top;
      setActive(activeEntryIndex(
        entries.map(e => (found[e.index] ? found[e.index].getBoundingClientRect().top - bodyTop : Infinity)),
      ));
    };
    update();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      body.removeEventListener('scroll', onScroll);
    };
  }, [bodyRef, entries, headings]);

  useEffect(() => {
    panelRef.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  // Esc closes the outline before it can close the modal; clicking elsewhere closes it too.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || e.target.closest?.('[data-outline-toggle]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  const jump = (entry) => {
    headings()[entry.index]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    onClose();
  };

  return (
    <nav ref={panelRef} className="reader-outline" aria-label="Outline">
      <ul>
        {entries.map((entry, i) => (
          <li key={entry.index}>
            <button
              type="button"
              className={`reader-outline-item${i === active ? ' is-active' : ''}`}
              style={{ paddingLeft: `${0.6 + entry.depth * 0.9}rem` }}
              title={entry.text}
              aria-current={i === active ? 'location' : undefined}
              onClick={() => jump(entry)}
            >
              {entry.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
