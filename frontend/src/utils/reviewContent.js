import { marked } from 'marked';
import { sanitizeHtml } from './sanitizeHtml';

// Detect whether existing content is already HTML (from new editor) or
// legacy Markdown (from the old textarea-based reviews).
function isLikelyHtml(s) {
  if (!s) return false;
  return /<\/?(p|h[1-6]|ul|ol|li|strong|em|u|s|blockquote|br|span|a|div|hr|pre|code)\b/i.test(s);
}

// Stored content as safe HTML for rendering or loading into the editor. Every
// display path goes through here, so it is also where stored HTML is sanitized.
export function normalizeReviewContent(content) {
  if (!content) return '';
  if (isLikelyHtml(content)) return sanitizeHtml(content);
  try {
    return sanitizeHtml(marked.parse(content, { breaks: true, gfm: true }));
  } catch {
    return sanitizeHtml(content);
  }
}
