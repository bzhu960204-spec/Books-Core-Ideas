import { describe, expect, it } from 'vitest';
import { applyChapterPlacements, planChapterMove } from './chapterOrder';

const ch = (id, orderIndex, partId = null) => ({ id, orderIndex, partId });
const parts = [{ id: 1 }, { id: 2 }];

describe('planChapterMove', () => {
  it('renumbers a plain book after a move within it', () => {
    const chapters = [ch(10, 1), ch(11, 2), ch(12, 3)];
    expect(planChapterMove(chapters, [], 12, null, 10)).toEqual([
      { id: 12, partId: null, orderIndex: 1 },
      { id: 10, partId: null, orderIndex: 2 },
      { id: 11, partId: null, orderIndex: 3 },
    ]);
    expect(planChapterMove(chapters, [], 10, null, null)).toEqual([
      { id: 11, partId: null, orderIndex: 1 },
      { id: 12, partId: null, orderIndex: 2 },
      { id: 10, partId: null, orderIndex: 3 },
    ]);
  });

  it('changes nothing when the chapter stays where it is', () => {
    const chapters = [ch(10, 1), ch(11, 2), ch(12, 3)];
    expect(planChapterMove(chapters, [], 12, null, null)).toBeNull();
    expect(planChapterMove(chapters, [], 11, null, 12)).toBeNull();
    expect(planChapterMove(chapters, [], 11, null, 11)).toBeNull();
  });

  it('renumbers the old and the new part when a chapter changes part', () => {
    const chapters = [ch(10, 1, 1), ch(11, 2, 1), ch(12, 1, 2)];
    expect(planChapterMove(chapters, parts, 10, 2, 12)).toEqual([
      { id: 10, partId: 2, orderIndex: 1 },
      { id: 12, partId: 2, orderIndex: 2 },
      { id: 11, partId: 1, orderIndex: 1 },
    ]);
  });

  it('keeps the number a part starts at, and treats a missing part as ungrouped', () => {
    const chapters = [ch(10, 4, 1), ch(11, 5, 1), ch(12, 6, 99)];
    expect(planChapterMove(chapters, parts, 11, 1, 10)).toEqual([
      { id: 11, partId: 1, orderIndex: 4 },
      { id: 10, partId: 1, orderIndex: 5 },
    ]);
    expect(planChapterMove(chapters, parts, 10, null, null)).toEqual([
      { id: 12, partId: null, orderIndex: 6 }, // stale part id replaced
      { id: 10, partId: null, orderIndex: 7 },
      { id: 11, partId: 1, orderIndex: 4 },
    ]);
  });
});

describe('applyChapterPlacements', () => {
  it('returns the chapters in their new order', () => {
    const chapters = [ch(10, 1), ch(11, 2), ch(12, 3)];
    const placements = planChapterMove(chapters, [], 12, null, 10);
    expect(applyChapterPlacements(chapters, placements).map(c => [c.id, c.orderIndex]))
      .toEqual([[12, 1], [10, 2], [11, 3]]);
  });
});
