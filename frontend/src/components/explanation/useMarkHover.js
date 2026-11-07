import { useCallback, useEffect, useRef, useState } from 'react';
import { highlightsSupported, textClientRects } from '../../utils/explanationAnchor';
import { hitTestMarks } from '../../utils/markHitTest';
import { placeFloating } from './useFloatingMenu';

export const SHOW_DELAY_MS = 300;
export const HIDE_DELAY_MS = 250;
const CLICK_SLOP_PX = 4;

/**
 * Hover / click interaction for saved passages in the rendered explanation.
 * Saved passages are painted with the CSS Custom Highlight API, so there are no
 * elements to listen on: the pointer position is hit-tested against the cached
 * client rects of each passage's range instead.
 *
 * `matches` is [{ mark, range }] from useSavedPassageHighlights. Returns the
 * card to show, `card = { mark, range, rect, pinned, editing }` (rect is the
 * hovered line, relative to `contentRef`), plus handlers for the card.
 */
export function useMarkHover({ contentRef, bodyRef, matches, enabled }) {
  const [target, setTarget] = useState(null); // { mark, range } under the pointer
  const [card, setCard] = useState(null);
  const popoverRef = useRef(null);
  const cardRef = useRef(null);
  const targetRef = useRef(null);
  const matchesRef = useRef(matches);
  const cacheRef = useRef({ dirty: true, items: [] });
  const timersRef = useRef({ show: 0, hide: 0 });
  const overPopoverRef = useRef(false);

  const commitCard = useCallback((next) => { cardRef.current = next; setCard(next); }, []);
  const commitTarget = useCallback((next) => { targetRef.current = next; setTarget(next); }, []);

  const clearTimer = useCallback((name) => {
    clearTimeout(timersRef.current[name]);
    timersRef.current[name] = 0;
  }, []);

  const close = useCallback(() => {
    clearTimer('show');
    clearTimer('hide');
    overPopoverRef.current = false;
    if (popoverRef.current?.contains(document.activeElement)) {
      contentRef.current?.focus({ preventScroll: true });
    }
    commitCard(null);
  }, [clearTimer, commitCard, contentRef]);

  const place = useCallback(() => {
    const el = popoverRef.current;
    const current = cardRef.current;
    const root = contentRef.current;
    const body = bodyRef.current;
    if (!el || !current || !root || !body) return;
    const origin = root.getBoundingClientRect();
    const r = current.rect;
    placeFloating(el, {
      left: r.left + origin.left,
      right: r.right + origin.left,
      top: r.top + origin.top,
      bottom: r.bottom + origin.top,
    }, body.getBoundingClientRect());
  }, [contentRef, bodyRef]);

  // Passages changed (saved, edited, removed, re-rendered): rebuild the rect
  // cache and keep the card on its passage, or close it when it is gone.
  useEffect(() => {
    matchesRef.current = matches;
    cacheRef.current.dirty = true;
    const current = cardRef.current;
    if (current) {
      const found = matches.find(m => m.mark.id === current.mark.id);
      if (found) commitCard({ ...current, mark: found.mark, range: found.range });
      else close();
    }
    const hovered = targetRef.current;
    if (hovered) {
      const found = matches.find(m => m.mark.id === hovered.mark.id);
      commitTarget(found ? { mark: found.mark, range: found.range } : null);
    }
  }, [matches, close, commitCard, commitTarget]);

  // Turning the interaction off (editing, selecting, highlights off) drops any
  // hover state; state is reset during render, refs and timers in the effect.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) {
      setTarget(null);
      setCard(null);
    }
  }
  useEffect(() => {
    if (enabled) return;
    clearTimer('show');
    clearTimer('hide');
    targetRef.current = null;
    cardRef.current = null;
    overPopoverRef.current = false;
  }, [enabled, clearTimer]);

  // Cached rects are relative to the content's top-left corner, so scrolling
  // the reader does not invalidate them; resizing the content does.
  useEffect(() => {
    const root = contentRef.current;
    if (!enabled || !root || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => { cacheRef.current.dirty = true; });
    observer.observe(root);
    return () => observer.disconnect();
  }, [enabled, contentRef]);

  const hitAt = useCallback((clientX, clientY) => {
    const root = contentRef.current;
    if (!root) return null;
    const origin = root.getBoundingClientRect();
    const cache = cacheRef.current;
    if (cache.dirty) {
      cache.items = matchesRef.current.map(({ mark, range }) => ({
        mark,
        rects: textClientRects(range).map(r => ({
          left: r.left - origin.left,
          right: r.right - origin.left,
          top: r.top - origin.top,
          bottom: r.bottom - origin.top,
        })),
      }));
      cache.dirty = false;
    }
    const hit = hitTestMarks(cache.items, clientX - origin.left, clientY - origin.top);
    const match = hit && matchesRef.current.find(m => m.mark === hit.mark);
    return match ? { mark: match.mark, range: match.range, rect: hit.rect } : null;
  }, [contentRef]);

  const openCard = useCallback((hit, pinned) => {
    clearTimer('hide');
    commitCard({ mark: hit.mark, range: hit.range, rect: hit.rect, pinned, editing: false });
  }, [clearTimer, commitCard]);

  const scheduleHide = useCallback(() => {
    // The pointer being on the card always wins, whatever order the leave /
    // enter events arrive in.
    if (timersRef.current.hide || overPopoverRef.current) return;
    timersRef.current.hide = setTimeout(() => {
      timersRef.current.hide = 0;
      const current = cardRef.current;
      if (current && !current.pinned && !current.editing && !overPopoverRef.current) close();
    }, HIDE_DELAY_MS);
  }, [close]);

  // Pointer over text: highlight the passage right away, open its card after a pause.
  useEffect(() => {
    const root = contentRef.current;
    if (!enabled || !root) return undefined;
    let frame = 0;
    let last = null;
    let down = null;

    const hover = (hit) => {
      const current = cardRef.current;
      if (current && (current.pinned || current.editing)) return;
      if (!hit) {
        clearTimer('show');
        commitTarget(null);
        if (current) scheduleHide();
        return;
      }
      if (current) {
        if (current.mark.id === hit.mark.id) clearTimer('hide');
        else scheduleHide();
      }
      if (targetRef.current?.mark.id === hit.mark.id) return;
      commitTarget({ mark: hit.mark, range: hit.range });
      clearTimer('show');
      timersRef.current.show = setTimeout(() => {
        timersRef.current.show = 0;
        openCard(hit, false);
      }, SHOW_DELAY_MS);
    };

    const process = () => {
      frame = 0;
      if (last) hover(hitAt(last.x, last.y));
    };
    const cancelFrame = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      if (e.buttons !== 0) {
        // Dragging a selection: no hover effects.
        last = null;
        cancelFrame();
        clearTimer('show');
        commitTarget(null);
        const current = cardRef.current;
        if (current && !current.pinned && !current.editing) close();
        return;
      }
      last = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(process);
    };
    const onLeave = () => {
      last = null;
      cancelFrame();
      hover(null);
    };
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
    // A plain click (no drag, no selection, not on a link) pins the card; this
    // is also the only way in on touch screens.
    const onUp = (e) => {
      const start = down;
      down = null;
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) >= CLICK_SLOP_PX) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (e.target instanceof Element && e.target.closest('a')) return;
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) return;
      clearTimer('show');
      commitTarget({ mark: hit.mark, range: hit.range });
      openCard(hit, true);
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    return () => {
      cancelFrame();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
    };
  }, [enabled, contentRef, hitAt, openCard, scheduleHide, close, clearTimer, commitTarget]);

  // Scrolling closes a hover card at once; a pinned card follows its line.
  useEffect(() => {
    const body = bodyRef.current;
    if (!enabled || !body) return undefined;
    const onScroll = () => {
      const current = cardRef.current;
      if (current && !current.pinned && !current.editing) close();
      else if (current) place();
      clearTimer('show');
      if (targetRef.current && !current?.pinned) commitTarget(null);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      body.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', place);
    };
  }, [enabled, bodyRef, close, place, clearTimer, commitTarget]);

  // Esc closes the card (first cancelling a note edit) without closing the
  // reader; a click outside closes a pinned card unless a note is being edited.
  const open = !!card;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      const current = cardRef.current;
      if (current?.editing) commitCard({ ...current, editing: false });
      else close();
    };
    const onPointerDown = (e) => {
      const current = cardRef.current;
      if (!current?.pinned || current.editing || popoverRef.current?.contains(e.target)) return;
      close();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, close, commitCard]);

  // Pinning by click moves focus into the card (the note editor takes it itself).
  const pinnedId = card?.pinned ? card.mark.id : null;
  useEffect(() => {
    if (pinnedId != null && !cardRef.current?.editing) {
      popoverRef.current?.querySelector('button')?.focus({ preventScroll: true });
    }
  }, [pinnedId]);

  // The passage under the pointer (or of the open card) is emphasized.
  const hoverRange = (target ?? card)?.range;
  useEffect(() => {
    if (!hoverRange || !highlightsSupported()) return undefined;
    const highlight = new Highlight(hoverRange);
    highlight.priority = 1;
    CSS.highlights.set('mark-hover', highlight);
    return () => CSS.highlights.delete('mark-hover');
  }, [hoverRange]);

  const over = !!target;
  useEffect(() => {
    const root = contentRef.current;
    root?.classList.toggle('is-over-mark', over);
    return () => root?.classList.remove('is-over-mark');
  }, [over, contentRef]);

  const setEditing = useCallback((editing) => {
    const current = cardRef.current;
    if (current) commitCard({ ...current, editing, pinned: current.pinned || editing });
  }, [commitCard]);

  const onPopoverEnter = useCallback(() => {
    overPopoverRef.current = true;
    clearTimer('hide');
  }, [clearTimer]);
  const onPopoverLeave = useCallback(() => {
    overPopoverRef.current = false;
    const current = cardRef.current;
    if (current && !current.pinned && !current.editing) scheduleHide();
  }, [scheduleHide]);

  return {
    card: enabled ? card : null,
    popoverRef,
    place,
    close,
    setEditing,
    onPopoverEnter,
    onPopoverLeave,
  };
}
