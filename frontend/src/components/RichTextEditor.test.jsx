import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import RichTextEditor from './RichTextEditor';
import Toaster from './feedback/Toaster';
import { clearToasts, getToasts } from './feedback/toast';

// ProseMirror measures layout when scrolling the selection into view; jsdom has none.
beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
  Element.prototype.scrollIntoView = () => {};
  document.elementFromPoint = () => null;
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.unstubAllGlobals();
});

// Parents keep the HTML in state (as ReviewBankPage and the explanation reader do);
// the toolbar's enabled states only refresh when the parent re-renders.
function Controlled({ value: initial = '', onChange, ...props }) {
  const [value, setValue] = useState(initial);
  return <RichTextEditor {...props} value={value} onChange={(html) => { setValue(html); onChange(html); }} />;
}

async function renderEditor(props = {}) {
  const onChange = vi.fn();
  render(<Controlled onChange={onChange} {...props} />);
  const pm = await screen.findByRole('textbox');
  return { pm, onChange };
}

function paste(target, { text = '', html = '', files = [] }) {
  const data = { 'text/plain': text, 'text/html': html };
  const clipboardData = {
    getData: (type) => data[type] ?? '',
    types: Object.keys(data).filter(type => data[type]),
    files,
    items: [],
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  act(() => { target.dispatchEvent(event); });
}

const pastePlainText = (target, text) => paste(target, { text });

// A setext heading: not detected as Markdown by auto mode and not touched by
// TipTap's paste rules, so only MD mode turns it into an <h1>.
const SETEXT = 'Title\n=====';

describe('RichTextEditor paste mode', () => {
  it('auto mode keeps text that does not look like Markdown literal', async () => {
    const { pm } = await renderEditor();
    pastePlainText(pm, SETEXT);
    expect(pm.querySelector('h1')).toBeNull();
    expect(pm.textContent).toContain('=====');
  });

  it('the paste handler sees the mode chosen in the toolbar', async () => {
    const { pm } = await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'MD' }));
    pastePlainText(pm, SETEXT);
    expect(pm.querySelector('h1')?.textContent).toBe('Title');

    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    pastePlainText(pm, `\n${SETEXT}`);
    expect(pm.querySelectorAll('h1')).toHaveLength(1);
    expect(pm.textContent).toContain('=====');
  });

  it('loads the initial value as sanitized HTML', async () => {
    const { pm } = await renderEditor({ value: '<p>hello <strong>world</strong></p><img src="x" onerror="alert(1)">' });
    expect(pm.querySelector('strong')?.textContent).toBe('world');
    expect(pm.innerHTML).not.toMatch(/onerror/i);
  });
});

const more = () => screen.getByRole('button', { name: '⋯' });
const lastHtml = (onChange) => onChange.mock.calls.at(-1)?.[0];
const selectAll = (pm) => fireEvent.keyDown(pm, { key: 'a', ctrlKey: true });
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('RichTextEditor Copilot and Markdown-card repairs', () => {
  const COPILOT_HTML = '<p>Intro</p><p></p><div><span>const a = 1;</span></div><div><span>  return a;</span></div><p></p><p>After</p>';
  const COPILOT_TEXT = 'Intro\nconst a = 1;\n  return a;\nAfter';

  it('offers to render a just-pasted Copilot answer\'s code lines as a code block', async () => {
    const { pm } = await renderEditor();
    paste(pm, { html: COPILOT_HTML, text: COPILOT_TEXT });

    expect(pm.querySelector('pre')).toBeNull();
    await waitFor(() => expect(more().title).toBe('More formatting — Copilot code blocks ready to render'));
    expect(more().classList.contains('has-pending')).toBe(true);

    fireEvent.click(more());
    expect(more().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Render 1 code block' }));

    expect(pm.querySelector('pre code').textContent).toBe('const a = 1;\n  return a;');
    expect(pm.textContent).toContain('Intro');
    expect(pm.textContent).toContain('After');
    expect(screen.getByRole('button', { name: 'Render code blocks' }).disabled).toBe(true);
  });

  it('withdraws the offer once the document is edited after the paste', async () => {
    const { pm } = await renderEditor();
    paste(pm, { html: COPILOT_HTML, text: COPILOT_TEXT });
    await waitFor(() => expect(more().classList.contains('has-pending')).toBe(true));

    await new Promise(resolve => setTimeout(resolve, 450));
    pastePlainText(pm, 'x');

    await waitFor(() => expect(more().title).toBe('More formatting'));
  });

  it('repairs a Copilot "Plain Text" block that pasted as inline code', async () => {
    const value = '<p><code>python&lt;/span&gt;&lt;/div&gt;&lt;div&gt;&lt;span&gt;print(1)</code></p>';
    const { pm, onChange } = await renderEditor({ value });

    fireEvent.click(more());
    fireEvent.click(await screen.findByRole('button', { name: 'Fix 1 broken code block' }));

    expect(pm.querySelector('pre code').textContent).toBe('```python\nprint(1)```');
    expect(lastHtml(onChange)).toBe('<pre><code>```python\nprint(1)```</code></pre><p></p>');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fix broken code blocks' }).disabled).toBe(true));
  });

  it('tags a rich-pasted Markdown-card screenshot with its source and converts it back to Markdown', async () => {
    const { pm, onChange } = await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Rich' }));
    paste(pm, {
      html: `<p>Before the card</p><img src="${PNG}"><p>After the card</p>`,
      text: 'Before the card\n# Card\n- item\nAfter the card',
    });

    expect(lastHtml(onChange)).toContain(`<img src="${PNG}" data-markdown-source="%23%20Card%0A-%20item">`);

    fireEvent.click(more());
    fireEvent.click(await screen.findByRole('button', { name: 'Convert 1 image to Markdown' }));

    expect(lastHtml(onChange)).not.toContain('<img');
    expect(pm.querySelector('pre code').textContent).toBe('# Card\n- item');
    expect(lastHtml(onChange)).toContain('<pre><code class="language-markdown"># Card\n- item</code></pre>');
  });

  it('loads stored card screenshots with their source', async () => {
    const value = `<p>x</p><img src="${PNG}" data-markdown-source="%23%20Stored">`;
    const { pm } = await renderEditor({ value });
    fireEvent.click(more());
    fireEvent.click(await screen.findByRole('button', { name: 'Convert 1 image to Markdown' }));
    expect(pm.querySelector('pre code').textContent).toBe('# Stored');
  });
});

describe('RichTextEditor images', () => {
  const file = (name, bytes) => new File([new Uint8Array(bytes)], name, { type: 'image/png' });

  it('drops pasted images over 5 MB and says so', async () => {
    render(<Toaster />);
    const { pm } = await renderEditor();
    paste(pm, { html: `<p>x</p><img src="data:image/png;base64,${'A'.repeat(7_000_004)}"><p>y</p>`, text: 'x\ny' });

    expect(screen.getByRole('status').textContent).toContain('An image larger than 5 MB was skipped.');
    expect(pm.querySelector('img')).toBeNull();
    expect(pm.textContent).toContain('y');
  });

  it('inserts pasted image files, skipping those over 5 MB', async () => {
    const { pm } = await renderEditor();
    paste(pm, { files: [file('small.png', 8), file('big.png', 5 * 1024 * 1024 + 1)] });

    await waitFor(() => expect(pm.querySelectorAll('img')).toHaveLength(1));
    expect(pm.querySelector('img').getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(getToasts().map(t => t.message)).toEqual(['An image larger than 5 MB was skipped.']);
  });

  it('inserts an image chosen from the toolbar', async () => {
    const { pm } = await renderEditor();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file('a.png', 8)] } });
    await waitFor(() => expect(pm.querySelector('img')).not.toBeNull());
  });
});

describe('RichTextEditor value and toolbar', () => {
  it('takes a new value from the parent without reporting a change', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor value="<p>First</p>" onChange={onChange} />);
    const pm = await screen.findByRole('textbox');
    rerender(<RichTextEditor value="<p>Second</p>" onChange={onChange} />);
    expect(pm.textContent).toBe('Second');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports an emptied document as an empty string', async () => {
    const { pm, onChange } = await renderEditor();
    expect(screen.getByTitle('Undo').disabled).toBe(true);
    pastePlainText(pm, 'x');
    expect(lastHtml(onChange)).toBe('<p>x</p>');
    fireEvent.click(screen.getByTitle('Undo'));
    expect(lastHtml(onChange)).toBe('');
  });

  it('applies block and inline formatting from the toolbars', async () => {
    const { pm, onChange } = await renderEditor({ value: '<p>Hello</p>' });
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });

    fireEvent.change(within(toolbar).getByTitle('Paragraph style'), { target: { value: 'h2' } });
    expect(lastHtml(onChange)).toBe('<h2>Hello</h2><p></p>');

    selectAll(pm);
    fireEvent.click(within(toolbar).getByTitle('Bold (Ctrl+B)'));
    expect(lastHtml(onChange)).toBe('<h2><strong>Hello</strong></h2><p></p>');

    fireEvent.click(more());
    const second = screen.getByRole('toolbar', { name: 'More formatting' });
    selectAll(pm);
    fireEvent.click(within(second).getByTitle('Align center'));
    expect(lastHtml(onChange)).toBe('<h2 style="text-align: center;"><strong>Hello</strong></h2><p style="text-align: center;"></p>');

    // Font family / size / colour: see "RichTextEditor text style (BUG-16)".
    selectAll(pm);
    fireEvent.click(within(second).getByTitle('Clear formatting'));
    expect(lastHtml(onChange)).toBe('<p>Hello</p><p></p>');

    fireEvent.click(more());
    expect(screen.queryByRole('toolbar', { name: 'More formatting' })).toBeNull();
  });

  it('adds and removes a link through the prompt', async () => {
    const prompt = vi.fn().mockReturnValueOnce('https://example.com').mockReturnValueOnce('');
    vi.stubGlobal('prompt', prompt);
    const { pm, onChange } = await renderEditor({ value: '<p>Hello</p>' });
    const link = within(screen.getByRole('toolbar', { name: 'Formatting' })).getByTitle('Link');

    selectAll(pm);
    fireEvent.click(link);
    expect(prompt).toHaveBeenCalledWith('Link URL (leave blank to remove):', '');
    expect(pm.querySelector('a').getAttribute('href')).toBe('https://example.com');

    fireEvent.click(link);
    expect(prompt).toHaveBeenLastCalledWith('Link URL (leave blank to remove):', 'https://example.com');
    expect(lastHtml(onChange)).toBe('<p>Hello</p>');
  });

  it('scans for malformed links and fixes them on request', async () => {
    const { pm } = await renderEditor({ value: '<p>fine</p>' });
    fireEvent.click(screen.getByTitle('Scan & fix malformed links'));
    expect(screen.getByText('未发现需要修复的链接。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByText('未发现需要修复的链接。')).toBeNull();
    cleanup();

    const { pm: pm2 } = await renderEditor({ value: '<p>See [[Report]](https://example.com/report.pdf) now</p>' });
    fireEvent.click(screen.getByTitle('Scan & fix malformed links'));
    expect(screen.getByRole('heading', { name: 'Fix malformed links?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '自动修复' }));
    expect(pm2.querySelector('a').getAttribute('href')).toBe('https://example.com/report.pdf');
    expect(pm2.textContent).not.toContain('[[');
    expect(pm).not.toBe(pm2);
  });
});
describe('RichTextEditor text style (BUG-16)', () => {
  // Regression: no extension registered the textStyle mark, so these controls threw.
  it('applies font size, colour and font family to the selection', async () => {
    const { pm, onChange } = await renderEditor({ value: '<p>Hello</p>' });
    fireEvent.click(more());
    const second = screen.getByRole('toolbar', { name: 'More formatting' });

    selectAll(pm);
    fireEvent.change(within(second).getByTitle('Font Size'), { target: { value: '18px' } });
    selectAll(pm);
    fireEvent.click(within(second).getByTitle('#ef4444'));
    selectAll(pm);
    fireEvent.change(within(second).getByTitle('Font Family'), { target: { value: 'Menlo, Consolas, monospace' } });

    const span = pm.querySelector('span');
    expect([span.style.fontSize, span.style.color, span.style.fontFamily]).toEqual(['18px', 'rgb(239, 68, 68)', 'Menlo, Consolas, monospace']);
    expect(lastHtml(onChange)).toMatch(/^<p><span style="[^"]*font-size: 18px[^"]*">Hello<\/span><\/p>$/);

    selectAll(pm);
    fireEvent.change(within(second).getByTitle('Font Size'), { target: { value: '' } });
    selectAll(pm);
    fireEvent.click(within(second).getByTitle('Clear color'));
    selectAll(pm);
    fireEvent.change(within(second).getByTitle('Font Family'), { target: { value: '' } });
    expect(lastHtml(onChange)).toBe('<p>Hello</p>');
  });

  it('keeps saved text styles when the content is opened again', async () => {
    const value = '<p><span style="color: rgb(239, 68, 68); font-size: 18px;">Red</span> plain</p>';
    const { pm } = await renderEditor({ value });
    const span = pm.querySelector('span');
    expect([span?.textContent, span?.style.color, span?.style.fontSize]).toEqual(['Red', 'rgb(239, 68, 68)', '18px']);
  });

  // Pasting keeps working as before: bold / italic written as inline styles still
  // count, but colours, sizes and fonts of the source page are not taken over.
  it('drops the colour, size and font of pasted text but keeps its formatting', async () => {
    const html = '<p><span style="color: rgb(255, 0, 0); font-size: 30px; font-family: Arial; font-weight: 700">Red</span>'
      + ' and <span style="font-style: italic; color: blue">blue</span> and <span style="font: 12px Arial">small</span></p>';
    const { pm, onChange } = await renderEditor();
    paste(pm, { html, text: 'Red and blue and small' });
    expect(lastHtml(onChange)).toBe('<p><strong>Red</strong> and <em>blue</em> and small</p>');
  });

  it('drops them from a rich paste that carries a Markdown card too', async () => {
    const { pm, onChange } = await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Rich' }));
    paste(pm, {
      html: `<p><span style="color: red">Before the card</span></p><img src="${PNG}"><p>After the card</p>`,
      text: 'Before the card\n# Card\nAfter the card',
    });
    expect(lastHtml(onChange)).toMatch(/^<p>Before the card<\/p><img src="data:image\/png[^"]*" data-markdown-source="%23%20Card"><p>After the card<\/p>/);
  });
});