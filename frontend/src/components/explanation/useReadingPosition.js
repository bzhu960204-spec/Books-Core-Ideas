import { useEffect, useState } from 'react';
import { findAnchor, flashRange, scrollRangeIntoView } from '../../utils/explanationAnchor';

/**
 * Where the reader opens: at the saved reading position (`initialScrollRatio`),
 * or scrolled to a saved passage (`initialAnchor`), which is flashed. If the
 * passage can no longer be found, falls back to its saved offset as a scroll
 * ratio and returns true ("missed"); `onAnchorResult` hears either way.
 */
export function useReadingPosition({
  bodyRef, contentRef, editing, explanation, initialScrollRatio, initialAnchor, onAnchorResult,
}) {
  const [anchorMissed, setAnchorMissed] = useState(false);

  // Restore the saved reading position when opening/returning to view mode.
  useEffect(() => {
    if (editing || initialScrollRatio == null) return undefined;
    const el = bodyRef.current;
    if (!el) return undefined;
    const id = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = max > 0 ? initialScrollRatio * max : 0;
    });
    return () => cancelAnimationFrame(id);
  }, [bodyRef, editing, initialScrollRatio, explanation]);

  // Jump to a saved passage: scroll to it and flash it. If the text can no
  // longer be found, fall back to the saved offset as a scroll ratio.
  useEffect(() => {
    if (editing || !initialAnchor) return undefined;
    const root = contentRef.current;
    const scroller = bodyRef.current;
    if (!root || !scroller) return undefined;
    let stopFlash = null;
    const id = requestAnimationFrame(() => {
      const { range, ratio } = findAnchor(root, initialAnchor);
      if (range) {
        scrollRangeIntoView(scroller, range);
        stopFlash = flashRange(range);
      } else {
        const max = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = max > 0 ? ratio * max : 0;
      }
      setAnchorMissed(!range);
      onAnchorResult?.({ id: initialAnchor.id, exact: !!range });
    });
    return () => {
      cancelAnimationFrame(id);
      stopFlash?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, initialAnchor, explanation]);

  return anchorMissed;
}
