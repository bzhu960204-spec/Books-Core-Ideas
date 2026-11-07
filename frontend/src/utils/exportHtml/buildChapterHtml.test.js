import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildChapterHtml } from './buildChapterHtml';

const base = { bookTitle: 'Book', chapterTitle: 'Chapter 1', content: '<h2>Part</h2><p>Hello</p>', updatedAt: '2026-01-02', removeLinks: true, includePrintScript: false };
const png = (name, data = 'AAAA') => ({ name, dataUrl: `data:image/png;base64,${data}` });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T01:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('buildChapterHtml', () => {
  it.each([[undefined], [[]]])('adds nothing image-related without images (%j)', (images) => {
    const html = buildChapterHtml({ ...base, images });
    expect(html).not.toContain('chapter-images');
    expect(html).not.toContain('ci-');
    expect(html).not.toContain('no-js');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('content="width=device-width, initial-scale=1"');
    expect(html).toBe(buildChapterHtml(base));
  });

  it('embeds the images once, with the viewer script and styles', () => {
    const html = buildChapterHtml({ ...base, images: [png('one.png', 'AAAA'), png('two.png', 'BBBB')] });

    expect(html.match(/class="ci-fig"/g)).toHaveLength(2);
    expect(html.match(/data:image\/png;base64,AAAA/g)).toHaveLength(1);
    expect(html).toContain('src="data:image/png;base64,BBBB"');
    expect(html).toContain('<html lang="en" class="no-js has-images">');
    expect(html).toContain("<script>document.documentElement.classList.replace('no-js','js')</script>");
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('Chapter images (2)');
    expect(html).toContain('id="chapter-images"');
    // The viewer's CSS and script are inlined, after the chapter content.
    expect(html).toContain('.ci-panel');
    expect(html).toContain('#chapter-images .ci-fig');
    expect(html.indexOf('chapter-images-fallback" id')).toBeGreaterThan(html.indexOf('class="note-content"'));
    expect(html.indexOf('chapter-images-fallback" id')).toBeLessThan(html.indexOf('</main>'));
  });

  it('escapes image names', () => {
    const html = buildChapterHtml({ ...base, images: [png('<b>"x".png')] });
    expect(html).toContain('data-name="&lt;b&gt;&quot;x&quot;.png"');
    expect(html).toContain('1 / 1 · &lt;b&gt;&quot;x&quot;.png');
    expect(html).not.toContain('<b>"x".png');
  });

  it('leaves out images whose data URL is not an allowed image', () => {
    const html = buildChapterHtml({
      ...base,
      images: [
        { name: 'svg', dataUrl: 'data:image/svg+xml;base64,AAAA' },
        { name: 'quote', dataUrl: 'data:image/png;base64,AAAA" onerror="x' },
      ],
    });
    expect(html).not.toContain('chapter-images');
  });
});
