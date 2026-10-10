// Detect and repair "malformed" Markdown/HTML links produced by AI chat
// exports (e.g. Copilot citations). Two shapes cause a raw URL to leak and an
// ugly horizontal scrollbar:
//   1. Double-bracket label:            [[Label]](…)
//   2. Nested link inside the dest:     [Label]([display](realUrl)…)
// Both collapse to a single, well-formed [Label](realUrl).

// Read a URL starting at `start` (index of the first char of "http…"),
// respecting balanced parens so filenames like "(Peter).pdf" stay intact.
function readUrl(text, start) {
  let depth = 0;
  let i = start;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) break;
      depth--;
    } else if (c === ']' || c === '<' || c === '>' || c === '"' || /\s/.test(c)) {
      break;
    }
  }
  return { url: text.slice(start, i), end: i };
}

// Index of the destination's closing ')'. Prefers a balanced match, but Copilot
// filenames can carry an unbalanced '(' (e.g. "(z-library.sk,.pdf"), which never
// balances — so fall back to the last ')' on the same line.
function findDestEnd(text, destOpen) {
  let depth = 0;
  for (let k = destOpen; k < text.length; k++) {
    const c = text[k];
    if (c === '\n') break;
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return k;
    }
  }
  let last = -1;
  for (let k = destOpen + 1; k < text.length; k++) {
    const c = text[k];
    if (c === '\n') break;
    if (c === ')') last = k;
  }
  return last;
}

// Try to parse a malformed link beginning at `start` ('['). Returns null when
// the construct is a normal, well-formed link (so it is left untouched).
function tryParseMalformed(text, start) {
  let i = start;
  const isDouble = text[i] === '[' && text[i + 1] === '[';
  i += isDouble ? 2 : 1;

  // Label runs up to the first closing bracket.
  const labelStart = i;
  while (i < text.length && text[i] !== ']') i++;
  if (i >= text.length) return null;
  const label = text.slice(labelStart, i).trim();
  i++; // consume ']'
  if (isDouble) {
    if (text[i] !== ']') return null;
    i++; // consume second ']'
  }

  if (text[i] !== '(') return null;
  const destOpen = i;

  // Peek past whitespace to decide if the destination is itself a link.
  let j = destOpen + 1;
  while (j < text.length && /\s/.test(text[j])) j++;
  const nested = text[j] === '[';

  // Only double-bracket labels or nested destinations are malformed.
  if (!isDouble && !nested) return null;

  // Grab the first real http(s) URL anywhere inside the destination.
  const httpIdx = text.indexOf('http', destOpen);
  if (httpIdx === -1) return null;

  // Close of the outer destination, then read the URL up to (never past) it.
  const destClose = findDestEnd(text, destOpen);
  if (destClose === -1) return null;
  const urlEnd = Math.min(readUrl(text, httpIdx).end, destClose);
  const url = text.slice(httpIdx, urlEnd);
  if (!url) return null;

  return {
    end: destClose + 1,
    label,
    url,
    replacement: `[${label}](${url})`,
    original: text.slice(start, destClose + 1),
  };
}

// Scan raw Markdown source, collapsing malformed links. Returns the repaired
// text plus a list of { original, fixed } for preview.
export function analyzeMarkdownLinks(text) {
  const fixes = [];
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      const parsed = tryParseMalformed(text, i);
      if (parsed) {
        fixes.push({ original: parsed.original, fixed: parsed.replacement });
        out += parsed.replacement;
        i = parsed.end;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return { fixed: out, fixes };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Drop any nested HTML tags, leaving visible text only. TipTap's autolink can
// inject an <a> into a citation label on paste; this recovers the plain label.
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

// Human-readable label from a URL: the decoded final path segment.
function labelFromUrl(href) {
  try {
    const path = href.split('?')[0];
    const seg = path.substring(path.lastIndexOf('/') + 1);
    return decodeURIComponent(seg) || href;
  } catch {
    return href;
  }
}

// Already-saved content is HTML. The broken link survives as literal bracket
// text followed by an <a> whose visible text is the bare URL.
const HTML_BRACKET_LINK_RE =
  /\[\[?([^[\]]*?)\]?\]\(\s*<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>\s*\)?/gi;
// Fallback: a standalone <a> whose text is itself a bare http(s) URL.
const HTML_EXPOSED_URL_RE =
  /<a\s+[^>]*href="([^"]+)"[^>]*>\s*(https?:\/\/[^<]+?)\s*<\/a>/gi;

// Scan rendered HTML, repairing exposed-URL links. Returns repaired HTML and a
// preview list. Leaves well-formed links (short visible text) untouched.
export function analyzeHtmlLinks(html) {
  const fixes = [];
  let out = html.replace(HTML_BRACKET_LINK_RE, (match, label, href) => {
    const text = stripTags(label || '').trim() || labelFromUrl(href);
    const fixed = `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
    fixes.push({ original: match, fixed });
    return fixed;
  });
  out = out.replace(HTML_EXPOSED_URL_RE, (match, href) => {
    const fixed = `<a href="${escapeHtml(href)}">${escapeHtml(labelFromUrl(href))}</a>`;
    fixes.push({ original: match, fixed });
    return fixed;
  });
  // Finally, collapse malformed links that survived as *literal text* (e.g. a
  // Rich paste with autolink off leaves "[[Label]](url)" untouched in the DOM).
  out = collapseTextMarkdownLinks(out, fixes);
  return { fixed: out, fixes };
}

// Walk HTML text, turning literal malformed markdown links into clean anchors.
function collapseTextMarkdownLinks(html, fixes) {
  let out = '';
  let i = 0;
  while (i < html.length) {
    if (html[i] === '[') {
      const parsed = tryParseMalformed(html, i);
      if (parsed) {
        const label = stripTags(parsed.label).trim() || labelFromUrl(parsed.url);
        const fixed = `<a href="${escapeHtml(parsed.url)}">${escapeHtml(label)}</a>`;
        fixes.push({ original: parsed.original, fixed });
        out += fixed;
        i = parsed.end;
        continue;
      }
    }
    out += html[i];
    i++;
  }
  return out;
}
