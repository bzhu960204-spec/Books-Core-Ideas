import { orderedBookChapters } from '../../pages/bookDetail/explanationExport';

/**
 * Groups marks by chapter, listing only chapters that have marks, in reading
 * order. Marks keep their incoming (text position) order inside a chapter. A mark
 * whose chapter is unknown still gets a group, appended at the end.
 */
export function marksByChapter(marks, chapters, parts, isParts) {
  const byChapter = new Map();
  for (const mark of marks) {
    if (!byChapter.has(mark.chapterId)) byChapter.set(mark.chapterId, []);
    byChapter.get(mark.chapterId).push(mark);
  }

  const groups = [];
  for (const { chapter } of orderedBookChapters(chapters, parts, isParts)) {
    const items = byChapter.get(chapter.id);
    if (!items) continue;
    groups.push({ chapterId: chapter.id, title: chapter.title, items });
    byChapter.delete(chapter.id);
  }
  for (const [chapterId, items] of byChapter) {
    groups.push({ chapterId, title: items[0].chapterTitle, items });
  }
  return groups;
}

/**
 * Which chapter to show given the previous and next chapter order. Keeps `id`
 * while it still has marks; otherwise moves to the chapter that took its place
 * (the next one, or the previous one if it was last), or the first chapter when
 * `id` was never in the previous order. Null when no chapter has marks.
 */
export function fallbackChapter(prevOrder, nextOrder, id) {
  if (nextOrder.length === 0) return null;
  if (nextOrder.includes(id)) return id;
  const at = prevOrder.indexOf(id);
  if (at < 0) return nextOrder[0];
  const remaining = new Set(nextOrder);
  for (let i = at + 1; i < prevOrder.length; i += 1) {
    if (remaining.has(prevOrder[i])) return prevOrder[i];
  }
  for (let i = at - 1; i >= 0; i -= 1) {
    if (remaining.has(prevOrder[i])) return prevOrder[i];
  }
  return nextOrder[0];
}
