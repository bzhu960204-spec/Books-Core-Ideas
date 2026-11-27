import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { looksLikeMarkdown } from './markdownPaste';

// Tags that carry structure worth keeping when rich text (e.g. a rendered AI
// answer) is pasted into a plain-text note.
const STRUCTURE_RE = /<(h[1-6]|p|li|ul|ol|table|pre|code|blockquote|strong|b|em|i|br|hr|a\s|annotation)\b/i;
const MATH_RE = /(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/;

const service = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});
service.use(gfm);
service.remove(['script', 'style', 'button', 'svg']);

// Same as turndown's rule, but "- item" / "1. item" instead of "-   item".
service.addRule('listItem', {
  filter: 'li',
  replacement: (content, node, options) => {
    const parent = node.parentNode;
    let prefix = `${options.bulletListMarker} `;
    if (parent.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start')) || 1;
      prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
    }
    const body = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, `\n${' '.repeat(prefix.length)}`);
    return prefix + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
  },
});

const texOf = (node) => node.querySelector?.('annotation[encoding="application/x-tex"]')?.textContent?.trim();

// KaTeX / MathML output → $…$ or $$…$$, using the TeX source kept in <annotation>.
service.addRule('tex', {
  filter: (node) => (node.classList?.contains('katex-display') || node.classList?.contains('katex')
    || node.nodeName === 'MATH') && !!texOf(node),
  replacement: (_content, node) => {
    const tex = texOf(node);
    const display = node.classList?.contains('katex-display') || node.getAttribute?.('display') === 'block';
    return display ? `\n\n$$${tex}$$\n\n` : `$${tex}$`;
  },
});

// Markdown escaping must not touch TeX already written as $…$ in the text.
const baseEscape = service.escape.bind(service);
service.escape = (text) => text.split(MATH_RE).map((part, i) => (i % 2 ? part : baseEscape(part))).join('');

export function htmlToMarkdown(html) {
  return service.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
}

// What to insert for a paste into a note, or null to let the browser paste the
// plain text. Markdown source (an AI "copy" button) is kept as is; rendered rich
// text is converted so its headings, lists and emphasis survive.
export function noteTextFromClipboard(clipboardData) {
  if (!clipboardData) return null;
  const html = clipboardData.getData('text/html');
  const text = clipboardData.getData('text/plain');
  if (!html || !STRUCTURE_RE.test(html)) return null;
  if (text && looksLikeMarkdown(text)) return null;
  const markdown = htmlToMarkdown(html);
  return markdown || null;
}
