import { describe, expect, it } from 'vitest';
import { hitTestMarks } from './markHitTest';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const mark = (id, quote) => ({ id, quote });

describe('hitTestMarks', () => {
  const matches = [
    { mark: mark(1, 'first line second line'), rects: [rect(10, 0, 100, 20), rect(0, 20, 60, 40)] },
    { mark: mark(2, 'other'), rects: [rect(200, 0, 260, 20)] },
  ];

  it('finds the passage under the point, on any of its lines', () => {
    expect(hitTestMarks(matches, 50, 10)).toEqual({ mark: matches[0].mark, rect: matches[0].rects[0] });
    expect(hitTestMarks(matches, 30, 30)).toEqual({ mark: matches[0].mark, rect: matches[0].rects[1] });
    expect(hitTestMarks(matches, 230, 5).mark.id).toBe(2);
  });

  it('returns null outside every passage', () => {
    expect(hitTestMarks(matches, 150, 10)).toBeNull();
    expect(hitTestMarks(matches, 80, 30)).toBeNull();
    expect(hitTestMarks([], 1, 1)).toBeNull();
  });

  it('tolerates a pixel of slop at the left and right edges only', () => {
    expect(hitTestMarks(matches, 9, 10)?.mark.id).toBe(1);
    expect(hitTestMarks(matches, 101, 10)?.mark.id).toBe(1);
    expect(hitTestMarks(matches, 8, 10)).toBeNull();
    expect(hitTestMarks(matches, 80, 20.5)).toBeNull();
  });

  it('skips empty rects left at line breaks', () => {
    const empty = [{ mark: mark(3, 'x'), rects: [rect(5, 0, 5, 20)] }];
    expect(hitTestMarks(empty, 5, 10)).toBeNull();
  });

  it('prefers the shortest passage where they overlap', () => {
    const overlapping = [
      { mark: mark(1, 'a long enclosing passage'), rects: [rect(0, 0, 100, 20)] },
      { mark: mark(2, 'enclosing'), rects: [rect(40, 0, 70, 20)] },
    ];
    expect(hitTestMarks(overlapping, 50, 10).mark.id).toBe(2);
    expect(hitTestMarks(overlapping, 10, 10).mark.id).toBe(1);
  });
});
