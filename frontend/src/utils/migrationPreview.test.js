import { describe, expect, it } from 'vitest';
import { previewSummary } from './migrationPreview';

describe('previewSummary', () => {
  it('keeps the v1 summary when the archive has nothing else', () => {
    expect(previewSummary({ chapterCount: 3, imageCount: 0, hasExplanations: true })).toBe('3 ch · 0 img · 详解');
    expect(previewSummary({ chapterCount: 1, imageCount: 2, hasExplanations: false,
      reviewCount: 0, bookmarkCount: 0, markCount: 0, collectionCount: 0 })).toBe('1 ch · 2 img');
  });

  it('adds what format v2 carries, with plurals', () => {
    expect(previewSummary({ chapterCount: 5, imageCount: 1, hasExplanations: false,
      reviewCount: 1, bookmarkCount: 4, markCount: 2, collectionCount: 1 }))
      .toBe('5 ch · 1 img · 1 review · 4 bookmarks · 2 marks · 1 collection');
  });
});
