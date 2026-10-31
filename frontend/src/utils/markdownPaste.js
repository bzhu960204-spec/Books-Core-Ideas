import { Marked } from 'marked';

// Heuristics: does this plain text look like Markdown source worth converting?
const FENCED_CODE_RE = /(^|\n)\s*```/;
const MD_FEATURE_RE = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|(\*\*|__).+?(\*\*|__)|\[[^\]]+\]\([^)]+\)|(^|\n)\|.+\|/;

export function looksLikeMarkdown(text) {
  return FENCED_CODE_RE.test(text) || MD_FEATURE_RE.test(text);
}

const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Math ($…$, $$…$$) is kept as literal text so Markdown inline rules (e.g. `_`
// and `*` as emphasis) don't mangle it. As marked extensions these never fire
// inside code blocks or code spans, which marked renders natively.
const mathBlock = {
  name: 'mathBlock',
  level: 'block',
  start: (src) => src.match(/(^|\n) {0,3}\$\$/)?.index,
  tokenizer(src) {
    const m = /^ {0,3}(\$\$[\s\S]+?\$\$)[ \t]*(?:\n|$)/.exec(src);
    return m ? { type: 'mathBlock', raw: m[0], text: m[1] } : undefined;
  },
  renderer: (token) => `<p>${escapeHtml(token.text)}</p>\n`,
};

const mathInline = {
  name: 'mathInline',
  level: 'inline',
  start: (src) => src.indexOf('$'),
  tokenizer(src) {
    const m = /^\$\$[\s\S]+?\$\$|^\$[^\n$]+?\$/.exec(src);
    return m ? { type: 'mathInline', raw: m[0] } : undefined;
  },
  renderer: (token) => escapeHtml(token.raw),
};

const pasteMarked = new Marked({ gfm: true, breaks: false, async: false });
pasteMarked.use({ extensions: [mathBlock, mathInline] });

export function markdownToHtml(src) {
  const html = pasteMarked.parse(src.replace(/\r\n/g, '\n'));
  // marked ends every code block with "\n", which the editor would keep as an
  // extra blank line at the bottom of the block.
  return html.replace(/\n<\/code><\/pre>/g, '</code></pre>');
}
