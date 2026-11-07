// Mouse hit-testing for saved passages. Highlights painted with the CSS Custom
// Highlight API are not DOM elements, so "which passage is under the pointer"
// is answered from the client rects of each passage's range.

// matches: [{ mark, rects }] with rects as DOMRect-like objects (left, right,
// top, bottom), all in the same coordinate space as (x, y).
// Returns { mark, rect } for the passage under the point, or null. Where
// passages overlap, the one with the shortest quote (the most specific) wins.
export function hitTestMarks(matches, x, y, slop = 1) {
  let best = null;
  for (const { mark, rects } of matches) {
    const rect = rects.find(r =>
      r.right - r.left > 0
      && r.left - slop <= x && x <= r.right + slop
      && r.top <= y && y <= r.bottom);
    if (!rect) continue;
    const length = mark.quote?.length ?? Infinity;
    if (!best || length < best.length) best = { mark, rect, length };
  }
  return best && { mark: best.mark, rect: best.rect };
}
