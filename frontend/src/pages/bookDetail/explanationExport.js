/**
 * Every chapter in reading order: parts by orderIndex, each part's chapters by
 * orderIndex, then the chapters outside every part. Entries carry their part's
 * number and title (null outside a part).
 */
export function orderedBookChapters(chapters, parts, isParts) {
  if (!isParts) {
    return [...chapters]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map(c => ({ chapter: c, partOrder: null, partTitle: null }));
  }
  const sortedParts = [...parts].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const ordered = [];
  sortedParts.forEach((part, pIdx) => {
    chapters
      .filter(c => c.partId === part.id)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .forEach(c => ordered.push({ chapter: c, partOrder: part.orderIndex || pIdx + 1, partTitle: part.title }));
  });
  const partIds = new Set(sortedParts.map(p => p.id));
  chapters
    .filter(c => !partIds.has(c.partId))
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .forEach(c => ordered.push({ chapter: c, partOrder: null, partTitle: null }));
  return ordered;
}

/**
 * The chapters offered by "Export Explanations", in reading order. Each gets a
 * book-wide sequence number (counting chapters without an explanation too) and
 * its part's number, so exported file names sort into reading order. Only
 * chapters with an explanation are returned.
 */
export function explanationExportChapters(chapters, parts, isParts) {
  const ordered = orderedBookChapters(chapters, parts, isParts);
  const withExplanation = new Set(chapters.filter(c => c.hasExplanation).map(c => c.id));
  return ordered
    .map((o, idx) => ({ id: o.chapter.id, title: o.chapter.title, seq: idx + 1, partOrder: o.partOrder, partTitle: o.partTitle, imageCount: o.chapter.imageCount ?? 0 }))
    .filter(o => withExplanation.has(o.id));
}
