// Reordering chapters by drag and drop. A chapter's number (orderIndex) is both its
// sort key and the number shown on its card. A move renumbers only the groups it
// touches (the chapter's old group and its new one; a plain book is a single
// group), consecutively from the number the group started at before the move, so
// a part numbered from 1 stays that way and a book numbered across parts keeps its
// numbers for plain reordering.

const groupKey = (chapter, partIds) => (partIds.has(chapter.partId) ? chapter.partId : null);

const firstNumber = (group) => {
  const numbers = group.map(c => c.orderIndex).filter(Number.isFinite);
  return numbers.length > 0 ? Math.min(...numbers) : 1;
};

/**
 * Where chapters end up when `chapterId` is dropped into `targetPartId` (null =
 * ungrouped / a plain book) in front of `beforeChapterId` (null = at the end).
 * `chapters` is in display order. Returns the chapters whose part or number
 * changes, as [{ id, partId, orderIndex }], or null when nothing changes.
 */
export function planChapterMove(chapters, parts, chapterId, targetPartId, beforeChapterId) {
  const moved = chapters.find(c => c.id === chapterId);
  if (!moved || beforeChapterId === chapterId) return null;
  const partIds = new Set(parts.map(p => p.id));
  const sourceKey = groupKey(moved, partIds);
  const targetKey = targetPartId != null && partIds.has(targetPartId) ? targetPartId : null;

  const inGroup = (key) => chapters.filter(c => c.id !== chapterId && groupKey(c, partIds) === key);
  const startOf = (key) => firstNumber(chapters.filter(c => groupKey(c, partIds) === key));
  const target = inGroup(targetKey);
  const at = beforeChapterId == null ? -1 : target.findIndex(c => c.id === beforeChapterId);
  target.splice(at === -1 ? target.length : at, 0, moved);

  const placements = new Map();
  const place = (group, key) => group.forEach((c, i) => {
    const number = startOf(key) + i;
    if (c.orderIndex !== number || (c.partId ?? null) !== key) {
      placements.set(c.id, { id: c.id, partId: key, orderIndex: number });
    }
  });
  place(target, targetKey);
  if (sourceKey !== targetKey) place(inGroup(sourceKey), sourceKey);
  return placements.size > 0 ? [...placements.values()] : null;
}

/** `chapters` with the placements applied, kept in display order (number, then previous position). */
export function applyChapterPlacements(chapters, placements) {
  const byId = new Map(placements.map(p => [p.id, p]));
  return chapters
    .map((c, i) => {
      const p = byId.get(c.id);
      return { chapter: p ? { ...c, partId: p.partId, orderIndex: p.orderIndex } : c, i };
    })
    .sort((a, b) => (a.chapter.orderIndex ?? 0) - (b.chapter.orderIndex ?? 0) || a.i - b.i)
    .map(x => x.chapter);
}
