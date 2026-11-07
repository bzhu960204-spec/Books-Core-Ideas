import { afterEach, describe, expect, it } from 'vitest';
import { findAnchorMatches, findAnchorRanges, textClientRects } from './explanationAnchor';

function rootWith(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe('textClientRects', () => {
  const original = Range.prototype.getClientRects;
  afterEach(() => { Range.prototype.getClientRects = original; });

  // Like Chrome: a rect per text run (10px per character), plus the full-width
  // border box (600px) of every element the range fully contains.
  function stubLayout() {
    Range.prototype.getClientRects = function getClientRects() {
      const rects = [];
      const fragment = this.cloneContents();
      fragment.querySelectorAll('p, ul, li').forEach(() => rects.push({ left: 0, right: 600, top: 0, bottom: 20, width: 600 }));
      const text = this.toString().replace(/\s+/g, ' ').trim();
      if (text) rects.push({ left: 0, right: text.length * 10, top: 0, bottom: 20, width: text.length * 10 });
      return rects;
    };
  }

  it('leaves out the boxes of blocks a range spans, keeping only text', () => {
    stubLayout();
    const root = rootWith('<p>Alpha beta</p><ul><li>one</li><li>two</li></ul><p>gamma delta</p>');
    const range = document.createRange();
    range.setStart(root.querySelector('p').firstChild, 6);
    range.setEnd(root.lastChild.firstChild, 5);

    expect(range.getClientRects().some(r => r.width === 600)).toBe(true);
    expect(textClientRects(range).map(r => r.width)).toEqual([40, 30, 30, 50]);
  });

  it('handles a range inside a single text node', () => {
    stubLayout();
    const root = rootWith('<p>Alpha beta gamma</p>');
    const text = root.querySelector('p').firstChild;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 10);

    expect(textClientRects(range).map(r => r.width)).toEqual([40]);
  });
});

describe('findAnchorMatches', () => {
  const root = rootWith('<p>Alpha beta gamma delta.</p>');
  const beta = { id: 1, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma', startOffset: 6 };
  const missing = { id: 2, quote: 'nowhere', prefix: '', suffix: '', startOffset: 0 };
  const delta = { id: 3, quote: 'delta', prefix: 'gamma ', suffix: '.', startOffset: 17 };

  it('pairs each located passage with its range, skipping the ones not found', () => {
    const matches = findAnchorMatches(root, [beta, missing, delta]);
    expect(matches.map(m => [m.mark.id, m.range.toString()])).toEqual([[1, 'beta'], [3, 'delta']]);
  });

  it('keeps findAnchorRanges returning the same ranges', () => {
    expect(findAnchorRanges(root, [beta, missing, delta]).map(String)).toEqual(['beta', 'delta']);
    expect(findAnchorRanges(root, [])).toEqual([]);
  });
});
