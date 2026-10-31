const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One-line summary of a book in a migration-archive preview, e.g.
 * "12 ch · 3 img · 详解 · 1 review · 4 bookmarks". The counts added with archive
 * format v2 are only shown when present (v1 archives and empty books stay short).
 */
export function previewSummary(book) {
  const parts = [`${book.chapterCount} ch`, `${book.imageCount} img`];
  if (book.hasExplanations) parts.push('详解');
  if (book.reviewCount) parts.push(plural(book.reviewCount, 'review'));
  if (book.bookmarkCount) parts.push(plural(book.bookmarkCount, 'bookmark'));
  if (book.markCount) parts.push(plural(book.markCount, 'mark'));
  if (book.collectionCount) parts.push(plural(book.collectionCount, 'collection'));
  return parts.join(' · ');
}
