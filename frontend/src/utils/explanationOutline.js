// The outline of a chapter explanation: its h1–h4 headings, in document order.
// Built from the sanitized HTML the reader renders, so `index` is the position of
// the heading among OUTLINE_SELECTOR matches in the rendered content.

export const OUTLINE_SELECTOR = 'h1, h2, h3, h4';

/** Fewer headings than this aren't worth an outline. */
export const MIN_OUTLINE_ENTRIES = 3;

/**
 * `[{ index, level, depth, text }]` for the non-empty headings of `html`.
 * `depth` is the level relative to the shallowest heading present, so an
 * explanation that starts at h3 isn't indented.
 */
export function extractOutline(html) {
  if (!html || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  const entries = [];
  doc.body.querySelectorAll(OUTLINE_SELECTOR).forEach((el, index) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) entries.push({ index, level: Number(el.tagName[1]), text });
  });
  const shallowest = Math.min(...entries.map(e => e.level));
  return entries.map(e => ({ ...e, depth: e.level - shallowest }));
}

/**
 * Which entry the reader is at: the last one whose top has scrolled to (or above)
 * the top of the scroll container, allowing a small margin. `tops` are the entries'
 * tops relative to the container; before the first heading the first is active.
 */
export function activeEntryIndex(tops, margin = 24) {
  let active = tops.length > 0 ? 0 : -1;
  tops.forEach((top, i) => {
    if (top <= margin) active = i;
  });
  return active;
}
