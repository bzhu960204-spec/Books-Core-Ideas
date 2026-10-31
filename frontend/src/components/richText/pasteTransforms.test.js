import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropOversizeImages, stripPastedTextStyles, tagMarkdownCards, transformCopilotCodeBlocks } from './pasteTransforms';
import { repairEscapedCodeLines } from './codeRepairs';

afterEach(() => vi.unstubAllGlobals());

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('transformCopilotCodeBlocks', () => {
  it('turns runs of one-line divs between empty paragraphs into code blocks', () => {
    const html = '<p>a</p><p></p><div><span>x = 1</span></div><div><span>  y</span></div><p></p>'
      + '<p></p><div><span>z</span></div><p></p>';
    const { html: out, count } = transformCopilotCodeBlocks(html);
    expect(count).toBe(2);
    expect(out).toBe('<p>a</p><pre><code>x = 1\n  y</code></pre><pre><code>z</code></pre>');
  });

  it('leaves HTML without such runs alone', () => {
    expect(transformCopilotCodeBlocks('<p>a</p><div><p>b</p></div>')).toEqual({ html: '<p>a</p><div><p>b</p></div>', count: 0 });
    expect(transformCopilotCodeBlocks('<p>no divs</p>')).toEqual({ html: '<p>no divs</p>', count: 0 });
  });

  it('repairs a broken one-line card but leaves it to "Fix broken code blocks" to count', () => {
    const escaped = 'js&lt;/span&gt;&lt;/div&gt;&lt;div&gt;&lt;span&gt;run()';
    const { html, count } = transformCopilotCodeBlocks(`<p></p><div><span><code>${escaped}</code></span></div><p></p>`);
    expect(count).toBe(0);
    expect(html).toBe('<pre><code>```js\nrun()```</code></pre>');
  });
});

describe('repairEscapedCodeLines', () => {
  it('decodes escaped line markup and restores the fences', () => {
    expect(repairEscapedCodeLines('sh</span></div><div><span>ls -l')).toBe('```sh\nls -l```');
  });

  it('returns null for ordinary code', () => {
    expect(repairEscapedCodeLines('const a = "<div>";')).toBeNull();
  });
});

describe('tagMarkdownCards', () => {
  it('records each card screenshot\'s Markdown source found between its neighbours in the plain text', () => {
    const html = `<p>Intro text here</p><img src="${PNG}"><p>Outro text here</p>`;
    const out = tagMarkdownCards(html, 'Intro text here\n\n## Card\n* one\n\nOutro text here');
    expect(out).toContain('data-markdown-source="%23%23%20Card%0A*%20one"');
  });

  it('returns the HTML unchanged when there is nothing to tag', () => {
    const html = `<p>Intro</p><img src="${PNG}">`;
    expect(tagMarkdownCards(html, '')).toBe(html);
    expect(tagMarkdownCards('<p>no image</p>', 'text')).toBe('<p>no image</p>');
    expect(tagMarkdownCards(`<p>Intro</p><img src="${PNG}"><p>Outro</p>`, 'Different words entirely')).toBe(`<p>Intro</p><img src="${PNG}"><p>Outro</p>`);
  });
});

describe('stripPastedTextStyles', () => {
  it('removes colour, size and font declarations and keeps the rest as written', () => {
    const html = '<p style="text-align: center; color: red"><span style="font: italic 12px Arial; font-weight: 700; background-color: yellow">a</span>'
      + '<span style="color:blue">b</span><mark style="background-image: url(data:image/png;base64,AA==)">c</mark></p>';
    expect(stripPastedTextStyles(html)).toBe(
      '<p style="text-align: center"><span style=" font-weight: 700; background-color: yellow">a</span>'
      + '<span>b</span><mark style="background-image: url(data:image/png;base64,AA==)">c</mark></p>');
  });

  it('returns HTML without such declarations untouched', () => {
    const html = '<p data-pm-slice="1 1 []"><b style="font-weight:700">x</b></p><!--EndFragment-->';
    expect(stripPastedTextStyles(html)).toBe(html);
  });
});

describe('dropOversizeImages', () => {
  it('removes inline images over 5 MB and tells the user once', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const big = `<img src="data:image/png;base64,${'A'.repeat(7_000_004)}">`;
    expect(dropOversizeImages(`<p>a</p>${big}<img src="${PNG}">${big}`)).toBe(`<p>a</p><img src="${PNG}">`);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('keeps small and linked images', () => {
    const html = `<img src="${PNG}"><img src="https://example.com/a.png">`;
    expect(dropOversizeImages(html)).toBe(html);
  });
});
