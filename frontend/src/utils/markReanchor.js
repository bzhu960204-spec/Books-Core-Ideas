import { parseExplanationHtml, relocateAnchors } from './explanationAnchor';

const sameAnchor = (mark, a) =>
  mark.startOffset === a.startOffset && mark.endOffset === a.endOffset
  && (mark.prefix || '') === a.prefix && (mark.suffix || '') === a.suffix;

/**
 * What changing an explanation from `previousHtml` to `nextHtml` does to its saved
 * passages `marks` (both HTML strings as the reader renders them).
 *  - `newlyLost`: passages that can be found now but not in the new text. Saving
 *    orphans them, so the reader is asked first.
 *  - `updates`: the corrections to store afterwards (shape of markApi.updateAnchors):
 *    fresh anchors for passages that moved, `orphaned: false` for ones found again,
 *    `orphaned: true` for the ones that are gone. Unchanged passages are left out.
 */
export function planReanchor(previousHtml, nextHtml, marks) {
  if (!marks.length) return { newlyLost: [], updates: [] };
  const before = relocateAnchors(parseExplanationHtml(previousHtml), marks);
  const after = relocateAnchors(parseExplanationHtml(nextHtml), marks);
  const lostBefore = new Set(before.lost.map(m => m.id));
  const newlyLost = after.lost.filter(m => !lostBefore.has(m.id));

  const updates = [];
  for (const mark of marks) {
    const anchor = after.found.get(mark.id);
    if (!anchor) {
      if (!mark.orphaned) updates.push({ id: mark.id, orphaned: true });
    } else if (mark.orphaned || !sameAnchor(mark, anchor)) {
      updates.push({ id: mark.id, ...anchor, orphaned: false });
    }
  }
  return { newlyLost, updates };
}
