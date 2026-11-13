import { useEffect, useState } from 'react';

// Where in a drop container the pointer is: the chapter it would be inserted in
// front of (null = at the end) and, in that case, the last chapter, below which
// the insertion line shows. Compares the pointer with the middle of each card's
// header, so tall expanded cards do not push the drop position away from it.
function dropPosition(container, draggedChapterId, pointerY) {
  const cards = [...container.querySelectorAll('[data-chapter-id]')]
    .filter(el => Number(el.dataset.chapterId) !== draggedChapterId);
  for (const card of cards) {
    const rect = (card.firstElementChild ?? card).getBoundingClientRect();
    if (pointerY < rect.top + rect.height / 2) {
      return { beforeId: Number(card.dataset.chapterId), afterId: null };
    }
  }
  const last = cards[cards.length - 1];
  return { beforeId: null, afterId: last ? Number(last.dataset.chapterId) : null };
}

/**
 * Dragging a chapter to a new place: another position in its list, another part,
 * or "Ungrouped" of a parts book. `onMove(chapterId, partId, beforeChapterId)` is
 * called on drop; partId null = ungrouped / plain book, beforeChapterId null = at
 * the end. Returns props for a chapter's drag handle and for a drop container (a
 * part, "Ungrouped" or a plain chapter list), keyed by the part id or a name (the
 * key highlighted while hovered), plus what to show on the cards while dragging.
 */
export function useChapterDrag(onMove) {
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [over, setOver] = useState(null); // { key, beforeId, afterId } or null

  // While dragging a chapter, auto-scroll the window when the pointer nears the
  // top/bottom edge so parts above/below the fold stay reachable as drop targets.
  useEffect(() => {
    if (draggedChapterId == null) return;
    const EDGE = 90;       // distance from edge (px) that triggers scrolling
    const MAX_SPEED = 20;  // max scroll step (px) per frame at the very edge
    let pointerY = null;
    let rafId = null;

    const onDragOver = e => { pointerY = e.clientY; };

    const step = () => {
      if (pointerY != null) {
        const vh = window.innerHeight;
        if (pointerY < EDGE) {
          window.scrollBy(0, -MAX_SPEED * ((EDGE - pointerY) / EDGE));
        } else if (pointerY > vh - EDGE) {
          window.scrollBy(0, MAX_SPEED * ((pointerY - (vh - EDGE)) / EDGE));
        }
      }
      rafId = requestAnimationFrame(step);
    };

    window.addEventListener('dragover', onDragOver);
    rafId = requestAnimationFrame(step);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [draggedChapterId]);

  const reset = () => { setDraggedChapterId(null); setOver(null); };

  const dragHandle = (chapterId) => ({
    onDragStart: e => { e.stopPropagation(); setDraggedChapterId(chapterId); e.dataTransfer.effectAllowed = 'move'; },
    onDragEnd: reset,
  });

  const dropTarget = (key, partId) => ({
    onDragOver: e => {
      if (draggedChapterId == null) return;
      e.preventDefault();
      const { beforeId, afterId } = dropPosition(e.currentTarget, draggedChapterId, e.clientY);
      setOver(prev => (
        prev && prev.key === key && prev.beforeId === beforeId && prev.afterId === afterId
          ? prev
          : { key, beforeId, afterId }
      ));
    },
    onDragLeave: e => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setOver(prev => (prev?.key === key ? null : prev));
    },
    onDrop: e => {
      if (draggedChapterId == null) return;
      e.preventDefault();
      const { beforeId } = dropPosition(e.currentTarget, draggedChapterId, e.clientY);
      const chapterId = draggedChapterId;
      reset();
      onMove(chapterId, partId, beforeId);
    },
  });

  // Where the insertion line shows on a chapter's card while dragging.
  const dropIndicator = (chapterId) => {
    if (over?.beforeId === chapterId) return 'before';
    if (over?.afterId === chapterId) return 'after';
    return null;
  };

  return { draggedChapterId, dragOverPartId: over?.key ?? null, dragHandle, dropTarget, dropIndicator };
}
