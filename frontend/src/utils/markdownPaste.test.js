import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown, markdownToHtml } from './markdownPaste';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html').body;

describe('markdownToHtml', () => {
  it('turns fenced code into a real code block with its language', () => {
    const body = parse(markdownToHtml('# Title\n\n```js\nif (a < b && c) {\n  run();\n}\n```\n\nAfter.'));
    const code = body.querySelector('pre > code');
    expect(code).not.toBeNull();
    expect(code.className).toBe('language-js');
    expect(code.textContent).toBe('if (a < b && c) {\n  run();\n}');
    expect(body.textContent).not.toContain('```');
    expect(body.querySelector('h1').textContent).toBe('Title');
    expect(body.querySelector('p').textContent).toBe('After.');
  });

  it('handles several fences, tilde fences and fences without a language', () => {
    const body = parse(markdownToHtml('```\nplain\n```\n\ntext\n\n~~~python\nprint(1)\n~~~\n'));
    const codes = body.querySelectorAll('pre > code');
    expect(codes).toHaveLength(2);
    expect(codes[0].textContent).toBe('plain');
    expect(codes[0].className).toBe('');
    expect(codes[1].textContent).toBe('print(1)');
    expect(codes[1].className).toBe('language-python');
  });

  it('leaves dollar signs and markdown-like text inside code untouched', () => {
    const src = '```bash\necho "$HOME" $PATH_VAR **not bold**\n```';
    const code = parse(markdownToHtml(src)).querySelector('pre > code');
    expect(code.textContent).toBe('echo "$HOME" $PATH_VAR **not bold**');
    expect(parse(markdownToHtml('Run `$a_b$` now')).querySelector('p > code').textContent).toBe('$a_b$');
  });

  it('still protects math from Markdown emphasis rules', () => {
    const p = parse(markdownToHtml('Inline $a_1 * b_2$ and *em*.')).querySelector('p');
    expect(p.textContent).toBe('Inline $a_1 * b_2$ and em.');
    expect(p.querySelectorAll('em')).toHaveLength(1);

    const block = parse(markdownToHtml('Before\n\n$$\nx_1 * y_2\n$$\n\nAfter')).textContent;
    expect(block).toContain('$$\nx_1 * y_2\n$$');
  });

  it('escapes HTML-significant characters inside math', () => {
    const p = parse(markdownToHtml('If $a<b$ then $c>d$.')).querySelector('p');
    expect(p.textContent).toBe('If $a<b$ then $c>d$.');
    expect(p.children).toHaveLength(0);
  });
});

describe('looksLikeMarkdown', () => {
  it('detects fenced code and common Markdown features', () => {
    expect(looksLikeMarkdown('```js\nx\n```')).toBe(true);
    expect(looksLikeMarkdown('# Heading')).toBe(true);
    expect(looksLikeMarkdown('- item')).toBe(true);
    expect(looksLikeMarkdown('just a sentence')).toBe(false);
  });
});
