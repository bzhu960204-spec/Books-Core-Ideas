import { describe, expect, it } from 'vitest';
import { fallbackChapter, marksByChapter } from './marksByChapter';

const mark = (id, chapterId, chapterTitle = `Chapter ${chapterId}`) => ({ id, chapterId, chapterTitle, quote: `q${id}` });

describe('marksByChapter', () => {
  it('lists only chapters with marks, in book order, keeping mark order inside a chapter', () => {
    const chapters = [
      { id: 1, title: 'One', orderIndex: 1 },
      { id: 2, title: 'Two', orderIndex: 2 },
      { id: 3, title: 'Three', orderIndex: 3 },
    ];
    const groups = marksByChapter([mark(10, 3), mark(11, 1), mark(12, 3)], chapters, [], false);
    expect(groups.map(g => [g.chapterId, g.title, g.items.map(m => m.id)])).toEqual([
      [1, 'One', [11]],
      [3, 'Three', [10, 12]],
    ]);
  });

  it('orders by part first, then by chapter inside the part', () => {
    const parts = [{ id: 20, title: 'B', orderIndex: 2 }, { id: 10, title: 'A', orderIndex: 1 }];
    const chapters = [
      { id: 1, title: 'In B', orderIndex: 1, partId: 20 },
      { id: 2, title: 'In A', orderIndex: 5, partId: 10 },
      { id: 3, title: 'Ungrouped', orderIndex: 0, partId: null },
    ];
    const groups = marksByChapter([mark(1, 3), mark(2, 1), mark(3, 2)], chapters, parts, true);
    expect(groups.map(g => g.chapterId)).toEqual([2, 1, 3]);
  });

  it('appends marks whose chapter is unknown, using the mark chapter title', () => {
    const groups = marksByChapter([mark(1, 99, 'Gone'), mark(2, 1)], [{ id: 1, title: 'One', orderIndex: 1 }], [], false);
    expect(groups.map(g => [g.chapterId, g.title])).toEqual([[1, 'One'], [99, 'Gone']]);
  });
});

describe('fallbackChapter', () => {
  it('keeps the chapter while it still has marks', () => {
    expect(fallbackChapter([1, 2, 3], [1, 2, 3], 2)).toBe(2);
  });

  it('moves to the next chapter when the current one disappears', () => {
    expect(fallbackChapter([1, 2, 3], [1, 3], 2)).toBe(3);
  });

  it('moves to the previous chapter when the last one disappears', () => {
    expect(fallbackChapter([1, 2, 3], [1, 2], 3)).toBe(2);
  });

  it('picks the first chapter when the id was never listed', () => {
    expect(fallbackChapter([], [4, 5], null)).toBe(4);
    expect(fallbackChapter([], [4, 5], 9)).toBe(4);
  });

  it('is null when no chapter has marks', () => {
    expect(fallbackChapter([1], [], 1)).toBeNull();
  });
});
