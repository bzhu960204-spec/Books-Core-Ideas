// Transforms of pasted clipboard content (HTML strings, image files). Pure
// apart from the size notice; used by pasteHandlers and useCodeBlockRepairs.
import { repairEscapedCodeLines } from './codeRepairs';
import { showToast } from '../feedback/toast';

// Pasted text keeps its formatting (bold, italic, … also when written as inline
// styles) but not the source's colour, font size or font: those belong to the
// editor's own controls, and a page's colours may be unreadable in another theme.
// Declarations are removed as text, the way ProseMirror reads styles for bold /
// italic, so what those see is unchanged (CSSOM would re-serialize a `font`
// shorthand into longhands such as font-weight).
const PASTED_TEXT_STYLE_RE = /\b(?:color|font(?:-size|-family)?)\s*:/i;
const DROPPED_DECLARATION = /^\s*(?:color|font|font-size|font-family)\s*:/i;

export function stripPastedTextStyles(html) {
  if (!html || !PASTED_TEXT_STYLE_RE.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of doc.body.querySelectorAll('[style]')) {
    const declarations = el.getAttribute('style').split(/;(?![^(]*\))/);
    const kept = declarations.filter(d => !DROPPED_DECLARATION.test(d));
    if (kept.length === declarations.length) continue;
    if (kept.some(d => d.trim())) el.setAttribute('style', kept.join(';'));
    else el.removeAttribute('style');
  }
  return doc.body.innerHTML;
}

// ── Copilot rich-answer pseudo-code blocks ────────────────────────────────────
// Copilot's rich (HTML) answers render code as a run of one-line <div><span>
// rows bounded by empty <p>s — not a <pre>, so it pastes as loose paragraphs.
// The signature only exists in the raw clipboard HTML, so it is detected at
// paste time and rewritten into real <pre><code> on demand.
export function transformCopilotCodeBlocks(html) {
  if (!html || !/<div/i.test(html)) return { html, count: 0 };
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const isEmptyP = (el) => !!el && el.tagName === 'P' && (el.textContent ?? '').trim() === '';
  const isCodeDiv = (el) => {
    if (!el || el.tagName !== 'DIV') return false;
    const kids = Array.from(el.children);
    return kids.length > 0 && kids.every(k => k.tagName === 'SPAN' || k.tagName === 'BR');
  };

  const matches = [];
  const consumed = new Set();
  for (const opener of Array.from(doc.querySelectorAll('p')).filter(isEmptyP)) {
    if (consumed.has(opener)) continue;
    const divs = [];
    let sib = opener.nextElementSibling;
    while (isCodeDiv(sib)) {
      divs.push(sib);
      sib = sib.nextElementSibling;
    }
    if (divs.length === 0 || !isEmptyP(sib)) continue;
    matches.push({ opener, closer: sib, divs });
    consumed.add(opener);
    consumed.add(sib);
  }

  // A single-line run whose <code> holds escaped line markup is a broken card:
  // repair it but leave it uncounted so only "Fix broken code blocks" claims it.
  const broken = new Map();
  for (const { opener, divs } of matches) {
    const inner = divs.length === 1 ? divs[0].querySelector('code') : null;
    const repaired = inner ? repairEscapedCodeLines(inner.textContent ?? '') : null;
    if (repaired !== null) broken.set(opener, repaired);
  }

  for (const { opener, closer, divs } of matches) {
    const pre = doc.createElement('pre');
    const code = doc.createElement('code');
    // textContent decodes entities and keeps leading spaces (indentation).
    code.textContent = broken.get(opener)
      ?? divs.map(d => (d.querySelector('span') ?? d).textContent ?? '').join('\n');
    pre.appendChild(code);
    opener.parentNode?.insertBefore(pre, opener);
    divs.forEach(d => d.remove());
    opener.remove();
    closer.remove();
  }

  return { html: doc.body.innerHTML, count: matches.length - broken.size };
}

// ── Pasted images ─────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function tooLargeNotice() {
  showToast('An image larger than 5 MB was skipped.', 'info');
}

// Remove inline base64 images over the size limit from pasted HTML.
export function dropOversizeImages(html) {
  if (!html || !/<img\b/i.test(html)) return html;
  let dropped = false;
  const out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = /\bsrc\s*=\s*["']data:[^"',]*;base64,([^"']*)["']/i.exec(tag);
    if (m && (m[1].length * 3) / 4 > MAX_IMAGE_BYTES) {
      dropped = true;
      return '';
    }
    return tag;
  });
  if (dropped) tooLargeNotice();
  return out;
}

// Read image files as data URLs, skipping (and reporting) oversize ones.
export async function readImageFiles(files) {
  const ok = files.filter(f => f.size <= MAX_IMAGE_BYTES);
  if (ok.length < files.length) tooLargeNotice();
  return Promise.all(ok.map(f => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  })));
}

// ── Markdown cards (rich paste) ───────────────────────────────────────────────
// AI chat UIs render a ```markdown fence as a "Markdown" card. The clipboard HTML
// carries it as a bare base64 screenshot <img>, while text/plain holds the card's
// raw Markdown with NO fence between the surrounding prose. Each image is located
// in the plain text via the HTML text just before/after it.
const ANCHOR_LEN = 24;
// Ignored when aligning HTML text with plain text (Markdown syntax differs).
const ALIGN_NOISE = /[\s*_`~#>-]/;

// Drop noise chars, keeping each kept char's index in the original string.
function flattenForAlign(s) {
  let text = '';
  const idx = [];
  for (let i = 0; i < s.length; i += 1) {
    if (ALIGN_NOISE.test(s[i])) continue;
    text += s[i];
    idx.push(i);
  }
  return { text, idx };
}

// Tag each card screenshot with its Markdown source (data-markdown-source,
// URI-encoded). Returns `html` unchanged when no card source was recovered.
export function tagMarkdownCards(html, plain) {
  if (!html || !plain || !/<img\b[^>]*\bsrc\s*=\s*["']data:image\//i.test(html)) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'))
    .filter(img => /^data:image\//i.test(img.getAttribute('src') ?? ''));
  if (!imgs.length) return html;

  const MARK = '\uE000';
  const markers = imgs.map((img) => {
    const t = doc.createTextNode(MARK);
    img.before(t);
    return t;
  });
  const segs = (doc.body.textContent ?? '').split(MARK);
  const flat = flattenForAlign(plain);

  let cursor = 0;
  const bodies = markers.map((_, k) => {
    const before = flattenForAlign(segs[k] ?? '').text.slice(-ANCHOR_LEN);
    const after = flattenForAlign(segs[k + 1] ?? '').text.slice(0, ANCHOR_LEN);

    let startFlat = cursor;
    if (before) {
      const i = flat.text.indexOf(before, cursor);
      if (i < 0) return null;
      startFlat = i + before.length;
    }
    let endFlat = flat.text.length;
    if (after) {
      const j = flat.text.indexOf(after, startFlat);
      if (j < 0) return null;
      endFlat = j;
    }

    const start = startFlat === 0 ? 0 : flat.idx[startFlat - 1] + 1;
    const end = endFlat >= flat.text.length ? plain.length : flat.idx[endFlat];
    // Strip blank edge lines but keep the first line's own indentation.
    const body = plain.slice(start, end).replace(/^\s*\n/, '').trimEnd();
    if (!body.trim()) return null;
    cursor = endFlat;
    return body;
  });

  if (!bodies.some(b => b !== null)) return html;

  markers.forEach((t, k) => {
    if (bodies[k] != null) imgs[k].setAttribute('data-markdown-source', encodeURIComponent(bodies[k]));
    t.remove();
  });
  return doc.body.innerHTML;
}
