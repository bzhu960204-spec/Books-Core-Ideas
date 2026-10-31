import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import RichTextEditor from './RichTextEditor';

// ProseMirror measures layout when scrolling the selection into view; jsdom has none.
beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
  Element.prototype.scrollIntoView = () => {};
  document.elementFromPoint = () => null;
});

afterEach(cleanup);

async function renderEditor(props = {}) {
  const onChange = vi.fn();
  render(<RichTextEditor value="" onChange={onChange} {...props} />);
  const pm = await screen.findByRole('textbox');
  return { pm, onChange };
}

function pastePlainText(target, text) {
  const data = { 'text/plain': text };
  const clipboardData = {
    getData: (type) => data[type] ?? '',
    types: Object.keys(data),
    files: [],
    items: [],
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  act(() => { target.dispatchEvent(event); });
}

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
