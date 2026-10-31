import DOMPurify from 'dompurify';

// Single place where untrusted HTML (clipboard pastes, stored explanations and
// reviews, imported archives) is made safe before the editor parses it or the
// app renders it. DOMPurify's defaults strip scripts, event-handler attributes
// and javascript: URLs while keeping formatting (headings, lists, tables, code,
// inline styles, classes, data: images). Links keep `target` because TipTap
// saves them with target="_blank", which DOMPurify would otherwise drop.
const CONFIG = { ADD_ATTR: ['target'] };

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  // A kept target must never give the opened page a handle on this window.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.hasAttribute?.('target')) {
      const rel = new Set((node.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      node.setAttribute('rel', [...rel].join(' '));
    }
  });
}

export function sanitizeHtml(html) {
  if (!html) return '';
  ensureHooks();
  return DOMPurify.sanitize(html, CONFIG);
}
