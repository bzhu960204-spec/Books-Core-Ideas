import { describe, expect, it } from 'vitest';
import { activeEntryIndex, extractOutline } from './explanationOutline';

describe('extractOutline', () => {
  it('lists h1–h4 headings in order, indented relative to the shallowest level', () => {
    const html = '<h2>One</h2><p>x</p><h3>One a</h3><h4>Deep</h4><h2>Two</h2><h5>Ignored</h5>';
    expect(extractOutline(html).map(e => [e.text, e.depth])).toEqual([
      ['One', 0], ['One a', 1], ['Deep', 2], ['Two', 0],
    ]);
  });

  it('skips empty headings but keeps indexes aligned with the rendered headings', () => {
    const entries = extractOutline('<h2>A</h2><h2> </h2><h2>B <em>bold</em></h2>');
    expect(entries.map(e => [e.index, e.text])).toEqual([[0, 'A'], [2, 'B bold']]);
  });

  it('is empty without headings', () => {
    expect(extractOutline('<p>text</p>')).toEqual([]);
    expect(extractOutline('')).toEqual([]);
  });
});

describe('activeEntryIndex', () => {
  it('picks the last heading scrolled to the top, or the first before any', () => {
    expect(activeEntryIndex([100, 400, 900])).toBe(0);
    expect(activeEntryIndex([-300, 10, 500])).toBe(1);
    expect(activeEntryIndex([-300, -200, -10])).toBe(2);
    expect(activeEntryIndex([])).toBe(-1);
  });
});
