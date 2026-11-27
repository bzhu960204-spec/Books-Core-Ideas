import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, noteTextFromClipboard } from './htmlToMarkdown';

const clipboard = (data) => ({ getData: (type) => data[type] || '' });

describe('noteTextFromClipboard', () => {
  it('turns a rendered AI answer into Markdown, keeping structure and TeX', () => {
    const html = '<h3>一、拆解 CI 与 CD</h3><ol><li><strong>CI</strong>：拉取代码 $\\rightarrow$ 编译</li>'
      + '<li>CD：自动部署</li></ol><p>结论</p>';
    const md = noteTextFromClipboard(clipboard({ 'text/html': html, 'text/plain': '一、拆解 CI 与 CD CI：拉取代码' }));
    expect(md).toBe('### 一、拆解 CI 与 CD\n\n1. **CI**：拉取代码 $\\rightarrow$ 编译\n2. CD：自动部署\n\n结论');
  });

  it('keeps Markdown source and plain text pastes as they are', () => {
    expect(noteTextFromClipboard(clipboard({ 'text/html': '<p><b>x</b></p>', 'text/plain': '**x**\n- a' }))).toBeNull();
    expect(noteTextFromClipboard(clipboard({ 'text/plain': 'just text' }))).toBeNull();
    expect(noteTextFromClipboard(clipboard({ 'text/html': '<span>just text</span>', 'text/plain': 'just text' }))).toBeNull();
  });

  it('reads KaTeX output back as TeX', () => {
    const html = '<p>a <span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi>'
      + '<annotation encoding="application/x-tex">x^2</annotation></semantics></math></span>'
      + '<span class="katex-html">x2</span></span> b</p>';
    expect(htmlToMarkdown(html)).toBe('a $x^2$ b');
  });
});
