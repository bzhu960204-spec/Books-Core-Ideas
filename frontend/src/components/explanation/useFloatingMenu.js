import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

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
    const first = rects[0] || current.getBoundingClientRect();
    const box = body.getBoundingClientRect();
    let top = first.top - menu.offsetHeight - 8;
    if (top < box.top + 4) top = first.bottom + 8;
    const maxLeft = Math.max(box.left + 8, box.right - menu.offsetWidth - 8);
    const left = Math.min(Math.max(first.left, box.left + 8), maxLeft);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = first.bottom > box.top && first.top < box.bottom ? 'visible' : 'hidden';
  }, [menuRef, bodyRef]);

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
