import { useEffect, useState } from 'react';

/**
 * Dragging a chapter onto another part (or "Ungrouped") of a parts book.
 * `onMove(chapterId, partId)` is called on drop; partId null = ungrouped.
 * Returns props for the drag handle of a chapter and for a drop target, keyed by
 * the part id or 'ungrouped' (the key that is highlighted while hovered).
 */
export function useChapterDrag(onMove) {
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [dragOverPartId, setDragOverPartId] = useState(null); // part id, 'ungrouped', or null

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

  const dragHandle = (chapterId) => ({
    onDragStart: e => { e.stopPropagation(); setDraggedChapterId(chapterId); e.dataTransfer.effectAllowed = 'move'; },
    onDragEnd: () => { setDraggedChapterId(null); setDragOverPartId(null); },
  });

  const dropTarget = (key, partId) => ({
    onDragOver: e => { if (draggedChapterId != null) { e.preventDefault(); setDragOverPartId(key); } },
    onDragLeave: () => setDragOverPartId(prev => (prev === key ? null : prev)),
    onDrop: e => { e.preventDefault(); onMove(draggedChapterId, partId); setDragOverPartId(null); setDraggedChapterId(null); },
  });

  return { dragOverPartId, dragHandle, dropTarget };
}
