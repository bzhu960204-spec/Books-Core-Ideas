import { describe, expect, it } from 'vitest';
import { clampOffset, clampScale, fitScale, zoomAt } from './zoomMath';

describe('fitScale', () => {
  it('shrinks an image that is larger than the container', () => {
    expect(fitScale({ width: 2000, height: 1000 }, { width: 500, height: 500 })).toBe(0.25);
    expect(fitScale({ width: 1000, height: 2000 }, { width: 500, height: 500 })).toBe(0.25);
  });

  it('keeps a small image at its natural size', () => {
    expect(fitScale({ width: 100, height: 50 }, { width: 500, height: 500 })).toBe(1);
  });

  it('falls back to 1 while a size is unknown', () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 500, height: 500 })).toBe(1);
  });
});

describe('clampScale', () => {
  it('applies both bounds', () => {
    expect(clampScale(0.01, 0.1, 8)).toBe(0.1);
    expect(clampScale(20, 0.1, 8)).toBe(8);
    expect(clampScale(2, 0.1, 8)).toBe(2);
  });
});

describe('zoomAt', () => {
  it('keeps the point under the cursor in place', () => {
    const view = { scale: 0.5, x: 30, y: -20 };
    const point = { x: 200, y: 120 };
    const next = zoomAt(view, 2, point);
    // The image coordinate under the point is the same before and after.
    expect((point.x - view.x) / view.scale).toBeCloseTo((point.x - next.x) / next.scale);
    expect((point.y - view.y) / view.scale).toBeCloseTo((point.y - next.y) / next.scale);
    expect(next.scale).toBe(2);
  });
});

describe('clampOffset', () => {
  const container = { width: 400, height: 300 };

  it('centres an image smaller than the container', () => {
    expect(clampOffset({ scale: 1, x: 99, y: -99 }, { width: 200, height: 100 }, container)).toEqual({ x: 100, y: 100 });
  });

  it('does not let a larger image be dragged into empty space', () => {
    const natural = { width: 1000, height: 800 };
    expect(clampOffset({ scale: 1, x: 50, y: 50 }, natural, container)).toEqual({ x: 0, y: 0 });
    expect(clampOffset({ scale: 1, x: -9999, y: -9999 }, natural, container)).toEqual({ x: -600, y: -500 });
    expect(clampOffset({ scale: 1, x: -100, y: -200 }, natural, container)).toEqual({ x: -100, y: -200 });
  });

  it('works per axis', () => {
    const natural = { width: 1000, height: 100 };
    expect(clampOffset({ scale: 1, x: 10, y: 0 }, natural, container)).toEqual({ x: 0, y: 100 });
  });
});
