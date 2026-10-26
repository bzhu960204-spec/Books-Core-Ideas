// Helpers for saving and re-finding passages in a rendered explanation.
//
// A passage is described by its plain text ("quote") plus surrounding context
// and character offsets. All offsets are measured against the *normalized*
// plain text of the rendered root: text nodes concatenated in document order,
// runs of whitespace collapsed to one space, and a single space inserted
// between block elements. Using the same normalization when saving and when
// locating keeps results stable across renders. The DOM is never modified.

const CONTEXT_PAD = 40;
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'TABLE', 'TR', 'TD', 'TH', 'HR', 'BR',
]);

const isSpace = (ch) => /\s/.test(ch);

function blockOf(node, root) {
  let el = node.parentNode;
  while (el && el !== root) {
    if (el.nodeType === 1 && BLOCK_TAGS.has(el.tagName)) return el;
    el = el.parentNode;
  }
  return root;
}

// Builds the normalized text of `root` along with a char -> DOM position map
// and, per text node, a raw-offset -> normalized-index table.
function buildTextIndex(root) {
  const chars = [];
  const map = [];
  const nodeInfo = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let prevBlock = null;

  const pushSpace = (node, offset) => {
    if (chars.length && chars[chars.length - 1] !== ' ') {
      chars.push(' ');
      map.push({ node, offset, virtual: true });
    }
  };

  let node = walker.nextNode();
  while (node) {
    const raw = node.nodeValue || '';
    const block = blockOf(node, root);
    if (prevBlock && block !== prevBlock) pushSpace(node, 0);
    prevBlock = block;

    const before = new Int32Array(raw.length + 1);
    for (let i = 0; i < raw.length; i += 1) {
      before[i] = chars.length;
      const ch = raw[i];
      if (isSpace(ch)) {
        pushSpace(node, i);
      } else {
        chars.push(ch);
        map.push({ node, offset: i, virtual: false });
      }
    }
    before[raw.length] = chars.length;
    nodeInfo.set(node, before);
    node = walker.nextNode();
  }

  return { text: chars.join(''), map, nodeInfo, root };
}

function boundaryToIndex(index, container, offset) {
  if (container.nodeType === 3 && index.nodeInfo.has(container)) {
    const table = index.nodeInfo.get(container);
    return table[Math.min(offset, table.length - 1)];
  }
  const point = document.createRange();
  point.setStart(container, offset);
  point.collapse(true);
  for (const [textNode, table] of index.nodeInfo) {
    if (point.comparePoint(textNode, 0) >= 0) return table[0];
  }
  return index.text.length;
}

// Returns { quote, prefix, suffix, startOffset, endOffset } for a DOM range
// inside `rootEl`, or null when the range holds no visible text.
export function captureAnchor(rootEl, range, pad = CONTEXT_PAD) {
  if (!rootEl || !range) return null;
  const index = buildTextIndex(rootEl);
  let start = boundaryToIndex(index, range.startContainer, range.startOffset);
  let end = boundaryToIndex(index, range.endContainer, range.endOffset);
  while (start < end && index.text[start] === ' ') start += 1;
  while (end > start && index.text[end - 1] === ' ') end -= 1;
  if (end <= start) return null;
  return {
    quote: index.text.slice(start, end),
    prefix: index.text.slice(Math.max(0, start - pad), start),
    suffix: index.text.slice(end, end + pad),
    startOffset: start,
    endOffset: end,
  };
}

function allIndexesOf(text, needle) {
  const found = [];
  if (!needle) return found;
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    found.push(at);
    from = at + 1;
  }
  return found;
}

function closest(candidates, target) {
  return candidates.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best));
}

function locate(index, anchor) {
  const total = index.text.length;
  const quote = anchor?.quote || '';
  const prefix = anchor?.prefix || '';
  const suffix = anchor?.suffix || '';
  const savedStart = Number.isFinite(anchor?.startOffset) ? anchor.startOffset : 0;
  const ratio = total > 0 ? Math.min(1, Math.max(0, savedStart / total)) : 0;

  let quoteStart = -1;
  const withContext = allIndexesOf(index.text, prefix + quote + suffix);
  if (withContext.length) {
    quoteStart = closest(withContext, savedStart - prefix.length) + prefix.length;
  } else {
    const plain = allIndexesOf(index.text, quote);
    if (plain.length) quoteStart = closest(plain, savedStart);
  }
  if (quoteStart < 0 || !quote) return { range: null, exact: false, ratio };

  const first = index.map[quoteStart];
  const last = index.map[quoteStart + quote.length - 1];
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  return { range, exact: true, ratio };
}

// Locates a saved passage in `rootEl`. Returns
// { range, exact, ratio }: `range` is a DOM Range (null if not found),
// `exact` says whether the text still matches, and `ratio` (0..1) is an
// estimated scroll position derived from the saved offset as a fallback.
export function findAnchor(rootEl, anchor) {
  return locate(buildTextIndex(rootEl), anchor);
}

// Locates many passages against a single text index. Returns the DOM ranges
// of the ones that could still be found.
export function findAnchorRanges(rootEl, anchors) {
  if (!anchors.length) return [];
  const index = buildTextIndex(rootEl);
  return anchors.map(anchor => locate(index, anchor).range).filter(Boolean);
}

export const highlightsSupported = () =>
  typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';

// Briefly emphasizes `range` without touching the DOM structure when the CSS
// Custom Highlight API is available; otherwise flashes the enclosing block.
// Returns a cleanup function.
export function flashRange(range, durationMs = 2200) {
  if (highlightsSupported()) {
    const highlight = new Highlight(range);
    highlight.priority = 2;
    CSS.highlights.set('mark-flash', highlight);
    const timer = setTimeout(() => CSS.highlights.delete('mark-flash'), durationMs);
    return () => { clearTimeout(timer); CSS.highlights.delete('mark-flash'); };
  }
  let el = range.startContainer;
  while (el && el.nodeType !== 1) el = el.parentNode;
  if (!el) return () => {};
  el.classList.add('mark-flash-block');
  const timer = setTimeout(() => el.classList.remove('mark-flash-block'), durationMs);
  return () => { clearTimeout(timer); el.classList.remove('mark-flash-block'); };
}

// Scrolls `scroller` so `range` sits roughly a third of the way down.
export function scrollRangeIntoView(scroller, range) {
  const rect = range.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  scroller.scrollTop += rect.top - box.top - scroller.clientHeight / 3;
}
