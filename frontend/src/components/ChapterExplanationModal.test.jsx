import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChapterExplanationModal from './ChapterExplanationModal';

vi.mock('./RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

beforeAll(() => {
  // Layout APIs jsdom lacks: the passage menu is placed next to the selected range,
  // so every range sits at the same spot inside the reader (see layoutReader).
  const rect = { x: 50, y: 10, top: 10, left: 50, right: 120, bottom: 30, width: 70, height: 20, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => [rect];
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderModal(props) {
  const base = { chapterTitle: 'Ch 1', bookTitle: 'Book', onClose: () => {}, onSave: vi.fn() };
  const utils = render(<ChapterExplanationModal {...base} {...props} />);
  return { ...utils, rerender: (next) => utils.rerender(<ChapterExplanationModal {...base} {...next} />) };
}

describe('ChapterExplanationModal keeps its draft in step with the explanation prop', () => {
  it('starts in edit mode with an empty draft when there is no explanation yet', async () => {
    renderModal({ explanation: null });
    expect((await screen.findByTestId('editor')).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('opens an existing explanation for reading with the draft preloaded', async () => {
    renderModal({ explanation: { content: '<p>Existing</p>' } });
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByText('Existing')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect((await screen.findByTestId('editor')).value).toBe('<p>Existing</p>');
  });

  it('shows the saved explanation in reading mode once the parent passes it back', async () => {
    const { rerender } = renderModal({ explanation: null });
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Typed</p>' } });

    rerender({ explanation: { content: '<p>Saved</p>' } });

    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('keeps unsaved edits when the parent re-renders with the same explanation', async () => {
    const explanation = { content: '<p>Existing</p>' };
    const { rerender } = renderModal({ explanation, startInEdit: true });
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Typed</p>' } });

    rerender({ explanation, startInEdit: true, saving: true });

    expect(screen.getByTestId('editor').value).toBe('<p>Typed</p>');
  });
});

const TEXT = '<p>Alpha beta gamma delta.</p>';

// Gives an element the scroll geometry jsdom does not compute.
function fakeScroller(el, { scrollHeight, clientHeight, scrollTop = 0 }) {
  let top = scrollTop;
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
  return el;
}

const readerBody = () => document.querySelector('.review-reader-body');

// The reader's visible box; ranges are at top 10-30, left 50 (see beforeAll).
function layoutReader() {
  readerBody().getBoundingClientRect = () => ({ top: 0, bottom: 500, left: 0, right: 800, width: 800, height: 500 });
}

function selectText(text) {
  layoutReader();
  const root = document.querySelector('.review-reader-content');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.nodeValue.indexOf(text);
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + text.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    return;
  }
  throw new Error(`"${text}" not found`);
}

function supportHighlights() {
  const highlights = new Map();
  vi.stubGlobal('CSS', { highlights });
  vi.stubGlobal('Highlight', class { constructor(...ranges) { this.ranges = ranges; } });
  return highlights;
}

describe('ChapterExplanationModal reading controls', () => {
  it('scales the text within bounds and remembers the size', () => {
    localStorage.setItem('explanationReaderFontScale', '1.55');
    renderModal({ explanation: { content: TEXT } });
    const content = () => document.querySelector('.review-reader-content');
    expect(content().style.getPropertyValue('--reader-font-scale')).toBe('1.55');

    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }));
    expect(content().style.getPropertyValue('--reader-font-scale')).toBe('1.6');
    expect(screen.getByRole('button', { name: 'Larger text' }).disabled).toBe(true);
    expect(localStorage.getItem('explanationReaderFontScale')).toBe('1.6');

    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }));
    expect(content().style.getPropertyValue('--reader-font-scale')).toBe('1.5');
  });

  it('clamps a stored size that is out of range', () => {
    localStorage.setItem('explanationReaderFontScale', '0.2');
    renderModal({ explanation: { content: TEXT } });
    expect(document.querySelector('.review-reader-content').style.getPropertyValue('--reader-font-scale')).toBe('0.85');
    expect(screen.getByRole('button', { name: 'Smaller text' }).disabled).toBe(true);
  });

  it('leaves fullscreen on Esc before Esc closes the reader', () => {
    const onClose = vi.fn();
    renderModal({ explanation: { content: TEXT }, onClose });
    const modal = () => document.querySelector('.review-reader-modal');

    fireEvent.click(screen.getByRole('button', { name: '⛶ Fullscreen' }));
    expect(modal().classList.contains('is-fullscreen')).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(modal().classList.contains('is-fullscreen')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Esc or a click outside while editing', () => {
    const onClose = vi.fn();
    renderModal({ explanation: null, onClose });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(document.querySelector('.modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a click outside while reading', () => {
    const onClose = vi.fn();
    renderModal({ explanation: { content: TEXT }, onClose });
    fireEvent.click(document.querySelector('.modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores the saved reading position', async () => {
    renderModal({ explanation: { content: TEXT }, initialScrollRatio: 0.25 });
    const body = fakeScroller(readerBody(), { scrollHeight: 1000, clientHeight: 400 });
    await waitFor(() => expect(body.scrollTop).toBe(150));
  });

  it('bookmarks the current scroll position', async () => {
    const onBookmark = vi.fn().mockResolvedValue(undefined);
    renderModal({ explanation: { content: TEXT }, onBookmark });
    fakeScroller(readerBody(), { scrollHeight: 1000, clientHeight: 400, scrollTop: 300 });

    fireEvent.click(screen.getByRole('button', { name: '🔖 Mark read here' }));

    expect(onBookmark).toHaveBeenCalledWith({ scrollRatio: 0.5 });
    expect(await screen.findByRole('button', { name: '✓ Saved' })).toBeTruthy();
  });

  it('shows the bookmark as saving while the parent saves it', () => {
    renderModal({ explanation: { content: TEXT }, bookmarking: true });
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
  });

  it('asks before deleting, then passes delete and close to the parent', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ explanation: { content: TEXT }, onDelete, onClose });

    fireEvent.click(screen.getByRole('button', { name: '🗑️ Delete' }));
    expect(screen.getByText('Delete the explanation of "Ch 1"? Its saved passages are deleted too. This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Delete the explanation of/)).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '🗑️ Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Close', { selector: 'button' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the confirmation on Esc', () => {
    const onClose = vi.fn();
    renderModal({ explanation: { content: TEXT }, onClose });
    fireEvent.click(screen.getByRole('button', { name: '🗑️ Delete' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(/Delete the explanation of/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays in the editor with the draft when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('down'));
    renderModal({ explanation: { content: '<p>Existing</p>' }, onSave });

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Typed</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByTestId('editor').value).toBe('<p>Typed</p>');
  });

  it('does not show the bookmark as saved when saving it fails', async () => {
    const onBookmark = vi.fn().mockRejectedValue(new Error('down'));
    renderModal({ explanation: { content: TEXT }, onBookmark });
    fireEvent.click(screen.getByRole('button', { name: '🔖 Mark read here' }));
    await waitFor(() => expect(onBookmark).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '✓ Saved' })).toBeNull();
  });

  it('keeps the draft across Cancel and saves it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal({ explanation: { content: '<p>Existing</p>' }, onSave });

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Typed</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Existing')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect((await screen.findByTestId('editor')).value).toBe('<p>Typed</p>');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ content: '<p>Typed</p>' });
    await waitFor(() => expect(screen.queryByTestId('editor')).toBeNull());
  });

  it('shows the parent saving the explanation', () => {
    renderModal({ explanation: null, saving: true });
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
  });
});

describe('ChapterExplanationModal saved passages', () => {
  it('saves a selected passage with a note, and undo deletes it', async () => {
    const onSaveMark = vi.fn().mockResolvedValue({ id: 42 });
    const onDeleteMark = vi.fn().mockResolvedValue(undefined);
    renderModal({ explanation: { content: TEXT }, onSaveMark, onDeleteMark });

    selectText('beta gamma');
    const menu = await screen.findByRole('region', { name: 'Save selected passage' });
    // Below the passage (no room above it), at its left edge.
    expect([menu.style.top, menu.style.left, menu.style.visibility]).toEqual(['38px', '50px', 'visible']);
    fireEvent.click(screen.getByRole('button', { name: '✎ Note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: '  why  ' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'Enter' });

    expect(await screen.findByText('✓ Passage saved')).toBeTruthy();
    expect(onSaveMark).toHaveBeenCalledWith({
      quote: 'beta gamma', prefix: 'Alpha ', suffix: ' delta.', startOffset: 6, endOffset: 16, note: 'why',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onDeleteMark).toHaveBeenCalledWith(42);
    await waitFor(() => expect(screen.queryByText('✓ Passage saved')).toBeNull());
  });

  it('saves a passage without a note in one click', async () => {
    const onSaveMark = vi.fn().mockResolvedValue({ id: 1 });
    renderModal({ explanation: { content: TEXT }, onSaveMark });

    selectText('Alpha');
    fireEvent.click(await screen.findByRole('button', { name: '📑 Save passage' }));
    await waitFor(() => expect(onSaveMark).toHaveBeenCalledWith(expect.objectContaining({ quote: 'Alpha', note: '' })));
  });

  it('does not offer a passage that is already saved', async () => {
    const marks = [{ id: 1, quote: 'beta gamma', prefix: 'Alpha ', suffix: ' delta.', startOffset: 6, endOffset: 16 }];
    renderModal({ explanation: { content: TEXT }, marks });

    selectText('beta gamma');
    expect(await screen.findByText('✓ Already saved')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '📑 Save passage' })).toBeNull();
  });

  it('reports a failed save', async () => {
    const onSaveMark = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ id: 9 });
    renderModal({ explanation: { content: TEXT }, onSaveMark });

    selectText('gamma');
    fireEvent.click(await screen.findByRole('button', { name: '📑 Save passage' }));
    expect(await screen.findByText('Could not save. Try again.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '📑 Save passage' }));
    expect(await screen.findByText('✓ Passage saved')).toBeTruthy();
    expect(screen.queryByText('Could not save. Try again.')).toBeNull();
  });

  // BUG-15: the notice was cleared before the request, so the menu holding the
  // error unmounted and the failure went unreported.
  it('reports a failed undo and offers Undo again', async () => {
    const onSaveMark = vi.fn().mockResolvedValue({ id: 9 });
    const onDeleteMark = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(undefined);
    renderModal({ explanation: { content: TEXT }, onSaveMark, onDeleteMark });

    selectText('gamma');
    fireEvent.click(await screen.findByRole('button', { name: '📑 Save passage' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('Could not undo. Remove it from Saved Passages.')).toBeTruthy();
    expect(screen.getByText('✓ Passage saved')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByText('✓ Passage saved')).toBeNull());
    expect(onDeleteMark.mock.calls).toEqual([[9], [9]]);
  });

  it('offers nothing while editing', async () => {
    renderModal({ explanation: { content: TEXT }, startInEdit: true });
    expect(await screen.findByTestId('editor')).toBeTruthy();
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.queryByRole('button', { name: '📑 Save passage' })).toBeNull();
  });

  it('jumps to a saved passage and flashes it', async () => {
    const onAnchorResult = vi.fn();
    const anchor = { id: 3, quote: 'gamma', prefix: 'beta ', suffix: ' delta', startOffset: 11 };
    renderModal({ explanation: { content: TEXT }, initialAnchor: anchor, onAnchorResult });

    await waitFor(() => expect(onAnchorResult).toHaveBeenCalledWith({ id: 3, exact: true }));
    expect(document.querySelector('.review-reader-content p').classList.contains('mark-flash-block')).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says so when a saved passage can no longer be found', async () => {
    const onAnchorResult = vi.fn();
    const anchor = { id: 4, quote: 'missing words', prefix: '', suffix: '', startOffset: 5 };
    renderModal({ explanation: { content: TEXT }, initialAnchor: anchor, onAnchorResult });

    await waitFor(() => expect(onAnchorResult).toHaveBeenCalledWith({ id: 4, exact: false }));
    expect(screen.getByRole('status').textContent).toMatch(/could not be found/);
  });

  it('highlights saved and pending passages, and remembers turning highlights off', async () => {
    const highlights = supportHighlights();
    const marks = [{ id: 1, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma', startOffset: 6, endOffset: 10 }];
    renderModal({ explanation: { content: TEXT }, marks });

    expect(highlights.get('mark-saved').ranges.map(r => r.toString())).toEqual(['beta']);
    selectText('delta');
    await waitFor(() => expect(highlights.get('mark-pending')?.ranges[0].toString()).toBe('delta'));

    fireEvent.click(screen.getByRole('button', { name: '🖍 Highlights: On' }));
    expect(highlights.has('mark-saved')).toBe(false);
    expect(localStorage.getItem('explanationReaderShowHighlights')).toBe('off');
    cleanup();

    renderModal({ explanation: { content: TEXT }, marks });
    expect(screen.getByRole('button', { name: '🖍 Highlights: Off' })).toBeTruthy();
    expect(highlights.has('mark-saved')).toBe(false);
  });

  it('hides the highlights switch where the browser cannot highlight', () => {
    renderModal({ explanation: { content: TEXT } });
    expect(screen.queryByRole('button', { name: /Highlights/ })).toBeNull();
  });
});