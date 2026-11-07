import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Places the fixed-position `el` next to `anchor` (a client-space rect): above
 * it, or below when there is no room, with its left edge clamped inside `box`
 * (the visible reader area). Hidden while the anchor is scrolled out of `box`.
 */
export function placeFloating(el, anchor, box) {
  let top = anchor.top - el.offsetHeight - 8;
  if (top < box.top + 4) top = anchor.bottom + 8;
  const maxLeft = Math.max(box.left + 8, box.right - el.offsetWidth - 8);
  const left = Math.min(Math.max(anchor.left, box.left + 8), maxLeft);
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.visibility = anchor.bottom > box.top && anchor.top < box.bottom ? 'visible' : 'hidden';
}

/**
 * Keeps the floating passage menu (`menuRef`) at the start of `range` (the
 * selection, or the passage just saved), so it stays clear of the browser's own
 * selection menu that appears near the end. Positioned imperatively so it can
 * follow scrolling of `bodyRef`; hidden while the passage is scrolled out of view.
 */
export function useFloatingMenu({ menuRef, bodyRef, range, editing }) {
  const menuRangeRef = useRef(null);
  const placeMenu = useCallback(() => {
    const menu = menuRef.current;
    const current = menuRangeRef.current;
    const body = bodyRef.current;
    if (!menu || !current || !body) return;
    const rects = current.getClientRects();
    placeFloating(menu, rects[0] || current.getBoundingClientRect(), body.getBoundingClientRect());
  },  [menuRef, bodyRef]);

  useLayoutEffect(() => {
    menuRangeRef.current = range;
    placeMenu();
  });

  useEffect(() => {
    const body = bodyRef.current;
    body?.addEventListener('scroll', placeMenu, { passive: true });
    window.addEventListener('resize', placeMenu);
    return () => {
      body?.removeEventListener('scroll', placeMenu);
      window.removeEventListener('resize', placeMenu);
    };
  }, [placeMenu, editing, bodyRef]);
}
