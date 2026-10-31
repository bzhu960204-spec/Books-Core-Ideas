// Repairs for Copilot answers already in the document: scans of the ProseMirror
// doc that find what the "Fix broken code blocks" and "Convert images to
// Markdown" buttons replace (see useCodeBlockRepairs).

// ── Broken Copilot "Plain Text" code blocks ───────────────────────────────────
// A card whose lines are ```lang / body / ``` pastes as ONE inline `code` run: the
// fences become code-span delimiters and the lines inside are their own escaped
// <div><span> markup. The text is in the doc, so it can be repaired any time.
const ESCAPED_LINES_RE = /<\/(?:span|div)>\s*<div\b/;

// Decode escaped line markup and put the eaten ``` pair back; null if not such text.
export function repairEscapedCodeLines(raw) {
  if (!ESCAPED_LINES_RE.test(raw)) return null;
  const parsed = new DOMParser().parseFromString(`<div><span>${raw}</span></div>`, 'text/html');
  const lines = Array.from(parsed.body.children).map(d => d.textContent ?? '');
  return lines.length < 2 ? null : '```' + lines.join('\n') + '```';
}

export function collectBrokenCodeOps(doc) {
  const ops = [];
  let lastTo = -1;
  doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') return false;
    if (node.type.name !== 'paragraph') return true;
    const child = node.childCount === 1 ? node.firstChild : null;
    if (!child?.isText || !child.marks.some(m => m.type.name === 'code')) return false;
    const text = repairEscapedCodeLines(child.text ?? '');
    if (text === null) return false;

    // Also swallow the empty paragraphs Copilot leaves around the block.
    const $pos = doc.resolve(pos);
    const parent = $pos.parent;
    const idx = $pos.index();
    const isEmptyP = n => !!n && n.type.name === 'paragraph' && n.content.size === 0;
    let from = pos;
    let to = pos + node.nodeSize;
    const prev = idx > 0 ? parent.child(idx - 1) : null;
    if (isEmptyP(prev) && from - prev.nodeSize >= lastTo) from -= prev.nodeSize;
    const next = idx + 1 < parent.childCount ? parent.child(idx + 1) : null;
    if (isEmptyP(next)) to += next.nodeSize;

    ops.push({ from, to, text });
    lastTo = to;
    return false;
  });
  return ops;
}

// Images tagged at paste time with their Markdown source (see tagMarkdownCards).
export function collectCardImageOps(doc) {
  const ops = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.markdownSource) {
      ops.push({ from: pos, to: pos + node.nodeSize, text: node.attrs.markdownSource });
    }
    return true;
  });
  return ops;
}
