import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';
import { normalizeReviewContent } from './reviewContent';

describe('sanitizeHtml', () => {
  it('removes scripts, event handlers and javascript: URLs', () => {
    const out = sanitizeHtml(
      '<p>hi</p><script>alert(1)</script><img src="x" onerror="alert(2)">'
      + '<a href="javascript:alert(3)">bad</a><svg onload="alert(4)"></svg>'
      + '<iframe src="https://evil.example"></iframe>',
    );
    expect(out).not.toMatch(/<script|onerror|onload|javascript:|<iframe/i);
    expect(out).toContain('<p>hi</p>');
    expect(out).toContain('bad');
  });

  it('keeps the formatting the editor and AI answers produce', () => {
    const html = '<h2>Title</h2><ul><li><p>item</p></li></ul>'
      + '<pre><code class="language-python">print(1)</code></pre>'
      + '<table><tbody><tr><th><p>A</p></th></tr><tr><td><p>1</p></td></tr></tbody></table>'
      + '<p><span style="color: rgb(255, 0, 0)">red</span> <mark data-color="#ff0">hl</mark> <code>inline</code></p>'
      + '<img src="data:image/png;base64,iVBORw0KGgo=" style="width: 50%">';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('keeps link targets but always adds noopener/noreferrer', () => {
    expect(sanitizeHtml('<a href="https://a.example" target="_blank">x</a>'))
      .toBe('<a href="https://a.example" target="_blank" rel="noopener noreferrer">x</a>');
    // TipTap's own rel value is left exactly as it was.
    const tiptapLink = '<a target="_blank" rel="noopener noreferrer nofollow" href="https://a.example">x</a>';
    expect(sanitizeHtml(tiptapLink)).toBe(tiptapLink);
  });

  it('is idempotent and handles empty input', () => {
    const once = sanitizeHtml('<p onclick="x()">a<b>b</b></p><img src=x onerror=y>');
    expect(sanitizeHtml(once)).toBe(once);
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});

describe('normalizeReviewContent (all stored-content display paths)', () => {
  it('sanitizes stored HTML', () => {
    const out = normalizeReviewContent('<p>stored</p><img src="x" onerror="alert(1)">');
    expect(out).toContain('<p>stored</p>');
    expect(out).not.toMatch(/onerror/i);
  });

  it('sanitizes raw HTML embedded in Markdown content', () => {
    const out = normalizeReviewContent('# Heading\n\nText <img src=x onerror=alert(1)> more');
    expect(out).toContain('<h1>Heading</h1>');
    expect(out).not.toMatch(/onerror/i);
  });
});
