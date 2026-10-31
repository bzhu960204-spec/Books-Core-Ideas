import { describe, expect, it } from 'vitest';
import { explanationExportChapters } from './explanationExport';

const ch = (id, orderIndex, partId = null, hasExplanation = true) => ({ id, title: `C${id}`, orderIndex, partId, hasExplanation });

describe('explanationExportChapters', () => {
  it('orders a parts book by part, then chapter, with chapters outside every part last', () => {
    const parts = [{ id: 2, title: 'Second', orderIndex: 2 }, { id: 1, title: 'First', orderIndex: 1 }];
    const chapters = [ch(10, 1, 2), ch(11, 2, 1), ch(12, 1, 1), ch(13, 1, null), ch(14, 1, 99)];
    expect(explanationExportChapters(chapters, parts, true)).toEqual([
      { id: 12, title: 'C12', seq: 1, partOrder: 1, partTitle: 'First' },
      { id: 11, title: 'C11', seq: 2, partOrder: 1, partTitle: 'First' },
      { id: 10, title: 'C10', seq: 3, partOrder: 2, partTitle: 'Second' },
      { id: 13, title: 'C13', seq: 4, partOrder: null, partTitle: null },
      { id: 14, title: 'C14', seq: 5, partOrder: null, partTitle: null },
    ]);
  });

  it('numbers parts by position when they have no order, and counts chapters without an explanation', () => {
    const parts = [{ id: 1, title: 'P', orderIndex: null }, { id: 2, title: 'Q', orderIndex: 0 }];
    const chapters = [ch(10, 1, 1, false), ch(11, 2, 1), ch(12, 1, 2)];
    expect(explanationExportChapters(chapters, parts, true)).toEqual([
      { id: 11, title: 'C11', seq: 2, partOrder: 1, partTitle: 'P' },
      { id: 12, title: 'C12', seq: 3, partOrder: 2, partTitle: 'Q' },
    ]);
  });

  it('orders a chapters book by chapter order', () => {
    const chapters = [ch(3, 3), ch(1, 1), ch(2, 2, null, false)];
    expect(explanationExportChapters(chapters, [], false).map(c => [c.id, c.seq])).toEqual([[1, 1], [3, 3]]);
  });
});
