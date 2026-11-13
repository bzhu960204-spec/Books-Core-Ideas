import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChapterExplanationModal from './ChapterExplanationModal';
import { QueryClientProvider } from '@tanstack/react-query';
import { chapterImageApi } from '../api';
import { createQueryClient } from '../queries';

vi.mock('./RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

vi.mock('../api', () => ({
  chapterImageApi: {
    getAll: vi.fn(),
    getUrl: (chapterId, imageId) => `/img/${chapterId}/${imageId}`,
  },
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

  it('shows the day the explanation was last edited', () => {
    renderModal({ explanation: { content: '<p>Existing</p>', updatedAt: '2026-01-02T09:30:00' } });
    expect(screen.getByText('2026-01-02')).toBeTruthy();
    expect(screen.queryByText(/T09:30/)).toBeNull();
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

const HEADED = '<h2>Intro</h2><p>a</p><h3>Detail</h3><p>b</p><h2>Wrap up</h2><p>c</p>';

describe('ChapterExplanationModal outline', () => {
  it('only offers an outline when the explanation has enough headings', () => {
    renderModal({ explanation: { content: '<h2>One</h2><p>a</p><h2>Two</h2>' } });
    expect(screen.queryByRole('button', { name: /Outline/ })).toBeNull();
  });

  it('opens over the text, jumps to a heading and closes', () => {
    renderModal({ explanation: { content: HEADED } });
    expect(screen.queryByRole('navigation', { name: 'Outline' })).toBeNull();

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole('button', { name: /Outline/ }));
    const nav = screen.getByRole('navigation', { name: 'Outline' });
    expect(Array.from(nav.querySelectorAll('button')).map(b => b.textContent)).toEqual(['Intro', 'Detail', 'Wrap up']);

    fireEvent.click(screen.getByRole('button', { name: 'Wrap up' }));
    expect(scrollIntoView.mock.contexts.at(-1).textContent).toBe('Wrap up');
    expect(screen.queryByRole('navigation', { name: 'Outline' })).toBeNull();
    delete Element.prototype.scrollIntoView;
  });

  it('closes on Esc without closing the modal, and the button toggles it', () => {
    const onClose = vi.fn();
    renderModal({ explanation: { content: HEADED }, onClose });
    const toggle = screen.getByRole('button', { name: /Outline/ });

    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Outline' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    fireEvent.pointerDown(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByRole('navigation', { name: 'Outline' })).toBeNull();
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

  describe('when an edit changes the text of saved passages', () => {
    const beta = { id: 1, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma', startOffset: 6, endOffset: 10 };

    const editTo = async (html) => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
      fireEvent.change(await screen.findByTestId('editor'), { target: { value: html } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    };

    it('asks before saving an edit that orphans a passage, and saves it only on confirmation', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderModal({ explanation: { content: TEXT }, marks: [beta], onSave });

      await editTo('<p>Alpha gamma delta.</p>');
      expect(await screen.findByRole('heading', { name: 'Saved passages will be orphaned' })).toBeTruthy();
      expect(screen.getByText('beta')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(screen.queryByRole('heading', { name: 'Saved passages will be orphaned' })).toBeNull();
      expect(screen.getByTestId('editor').value).toBe('<p>Alpha gamma delta.</p>');
      expect(onSave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save anyway' }));
      await waitFor(() => expect(onSave).toHaveBeenCalledWith({
        content: '<p>Alpha gamma delta.</p>', anchorUpdates: [{ id: 1, orphaned: true }],
      }));
      await waitFor(() => expect(screen.queryByTestId('editor')).toBeNull());
    });

    it('saves without asking when the passages are still there, and refreshes where they are', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderModal({ explanation: { content: TEXT }, marks: [beta], onSave });

      await editTo('<p>Intro. Alpha beta gamma delta.</p>');
      await waitFor(() => expect(onSave).toHaveBeenCalledWith({
        content: '<p>Intro. Alpha beta gamma delta.</p>',
        anchorUpdates: [{
          id: 1, prefix: 'Intro. Alpha ', suffix: ' gamma delta.', startOffset: 13, endOffset: 17, orphaned: false,
        }],
      }));
      expect(screen.queryByRole('heading', { name: 'Saved passages will be orphaned' })).toBeNull();
    });

    it('does not ask again for a passage that was already orphaned', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const gone = { id: 2, quote: 'missing words', prefix: '', suffix: '', startOffset: 3, orphaned: true };
      renderModal({ explanation: { content: TEXT }, marks: [gone], onSave });

      await editTo('<p>Alpha beta.</p>');
      await waitFor(() => expect(onSave).toHaveBeenCalledWith({ content: '<p>Alpha beta.</p>' }));
    });
  });

  it('re-links an orphaned passage to the selected text', async () => {
    const onRelinkMark = vi.fn().mockResolvedValue(undefined);
    const relinkMark = { id: 5, quote: 'gone text', orphaned: true };
    renderModal({ explanation: { content: TEXT }, relinkMark, onRelinkMark });
    expect(screen.getByText(/Select the new text/)).toBeTruthy();

    selectText('gamma');
    fireEvent.click(await screen.findByRole('button', { name: '🔗 Re-link here' }));
    await waitFor(() => expect(onRelinkMark).toHaveBeenCalledWith(5, {
      quote: 'gamma', prefix: 'Alpha beta ', suffix: ' delta.', startOffset: 11, endOffset: 16,
    }));
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

describe('ChapterExplanationModal highlight hover card', () => {
  const mark = {
    id: 1, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma', startOffset: 6, endOffset: 10,
    note: 'why', createdAt: '2026-11-03T10:00:00',
  };
  // Every range sits at left 50-120, top 10-30 (see beforeAll).
  const OVER = { clientX: 60, clientY: 20 };
  const content = () => document.querySelector('.review-reader-content');
  const card = () => screen.findByRole('dialog', { name: 'Saved passage note' });
  const hover = () => { layoutReader(); fireEvent.pointerMove(content(), { ...OVER, buttons: 0 }); };
  const click = () => {
    layoutReader();
    fireEvent.pointerDown(content(), OVER);
    fireEvent.pointerUp(content(), OVER);
  };

  it('shows the note after a short hover, and emphasizes the passage', async () => {
    const highlights = supportHighlights();
    renderModal({ explanation: { content: TEXT }, marks: [mark] });

    hover();
    await waitFor(() => expect(highlights.get('mark-hover')?.ranges[0].toString()).toBe('beta'));
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();
    const popover = await card();
    expect(popover.textContent).toContain('why');
    expect(popover.textContent).toContain('Saved 2026-11-03');
    expect(screen.queryByRole('button', { name: 'Close note' })).toBeNull();

    fireEvent.pointerLeave(content());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull());
    expect(highlights.has('mark-hover')).toBe(false);
  });

  // Moving from the text onto the card: React reports the card's pointer-enter
  // (on pointerout) before the text's native pointerleave arrives. The leave
  // must not restart the close timer once the pointer is on the card.
  it('stays open once the pointer is on the card, however the events interleave', async () => {
    supportHighlights();
    renderModal({ explanation: { content: TEXT }, marks: [mark] });

    hover();
    const popover = await card();
    fireEvent.pointerMove(content(), { clientX: 300, clientY: 200, buttons: 0 }); // the gap
    fireEvent.pointerEnter(popover);
    fireEvent.pointerLeave(content());
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(popover.isConnected).toBe(true);

    fireEvent.pointerLeave(popover);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull());
  });

  // Chrome's Range.getClientRects() also returns the full-width box of every
  // block a passage spans; the blank space inside those boxes is not highlighted.
  it('ignores the blank space of blocks a passage spans', async () => {
    supportHighlights();
    const original = Range.prototype.getClientRects;
    const block = { left: 0, right: 600, top: 100, bottom: 140, width: 600, height: 40 };
    const textRect = (top) => ({ left: 50, right: 80, top, bottom: top + 20, width: 30, height: 20 });
    Range.prototype.getClientRects = function getClientRects() {
      if (this.cloneContents().querySelector('ul')) return [block];
      return [textRect({ one: 100 }[this.toString()] ?? 10)];
    };
    try {
      const spanning = {
        id: 2, quote: 'Alpha one delta', prefix: '', suffix: '', startOffset: 0, endOffset: 15, note: 'span',
      };
      renderModal({ explanation: { content: '<p>Alpha</p><ul><li>one</li></ul><p>delta</p>' }, marks: [spanning] });
      layoutReader();

      fireEvent.pointerMove(content(), { clientX: 400, clientY: 120, buttons: 0 }); // blank, inside the <ul> box
      await new Promise(resolve => setTimeout(resolve, 450));
      expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();

      fireEvent.pointerMove(content(), { clientX: 60, clientY: 110, buttons: 0 }); // on the text
      expect((await card()).textContent).toContain('span');
    } finally {
      Range.prototype.getClientRects = original;
    }
  });

  it('offers to add a note to a passage that has none', async () => {
    supportHighlights();
    renderModal({ explanation: { content: TEXT }, marks: [{ ...mark, note: '' }] });

    hover();
    const popover = await card();
    expect(popover.textContent).toContain('No note');
    expect(screen.getByRole('button', { name: '✎ Add note' })).toBeTruthy();
  });

  it('does nothing away from a highlight, with highlights off, or while editing', async () => {
    supportHighlights();
    localStorage.setItem('explanationReaderShowHighlights', 'off');
    renderModal({ explanation: { content: TEXT }, marks: [mark] });
    hover();
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();
    cleanup();

    localStorage.clear();
    renderModal({ explanation: { content: TEXT }, marks: [mark] });
    fireEvent.pointerMove(content(), { clientX: 300, clientY: 200, buttons: 0 });
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(await screen.findByTestId('editor')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();
  });

  it('does not open while a selection is being made or exists', async () => {
    supportHighlights();
    renderModal({ explanation: { content: TEXT }, marks: [mark] });

    fireEvent.pointerMove(content(), { ...OVER, buttons: 1 });
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();

    selectText('delta');
    await screen.findByRole('region', { name: 'Save selected passage' });
    hover();
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();
  });

  it('pins the card on click; Esc closes only the card', async () => {
    supportHighlights();
    const onClose = vi.fn();
    renderModal({ explanation: { content: TEXT }, marks: [mark], onClose });

    click();
    const popover = await card();
    const close = screen.getByRole('button', { name: 'Close note' });
    expect(document.activeElement).toBe(close);

    fireEvent.pointerLeave(content());
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(popover.isConnected).toBe(true);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not pin when clicking a link inside the highlight', async () => {
    supportHighlights();
    renderModal({ explanation: { content: '<p>Alpha <a href="#x">beta</a> gamma delta.</p>' }, marks: [mark] });
    const link = content().querySelector('a');
    fireEvent.pointerDown(link, OVER);
    fireEvent.pointerUp(link, OVER);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();
  });

  it('edits the note; a failed save keeps the draft', async () => {
    supportHighlights();
    const onUpdateMarkNote = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(undefined);
    renderModal({ explanation: { content: TEXT }, marks: [mark], onUpdateMarkNote });

    hover();
    await card();
    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
    const input = screen.getByRole('textbox', { name: 'Note' });
    expect(input.value).toBe('why');
    fireEvent.change(input, { target: { value: '  new note  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Could not save the note. Try again.')).toBeTruthy();
    expect(onUpdateMarkNote).toHaveBeenCalledWith(1, 'new note');
    expect(screen.getByRole('textbox', { name: 'Note' }).value).toBe('  new note  ');

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull());
    expect(onUpdateMarkNote).toHaveBeenCalledTimes(2);
  });

  it('cancels a note edit with Esc, and closes the card with the next one', async () => {
    supportHighlights();
    renderModal({ explanation: { content: TEXT }, marks: [mark] });

    hover();
    await card();
    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Saved passage note' })).toBeTruthy();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull());
  });

  it('removes the passage, and Undo re-creates it with its note', async () => {
    supportHighlights();
    const onDeleteMark = vi.fn().mockResolvedValue(undefined);
    const onSaveMark = vi.fn().mockResolvedValue({ id: 2 });
    renderModal({ explanation: { content: TEXT }, marks: [mark], onDeleteMark, onSaveMark });

    hover();
    await card();
    fireEvent.click(screen.getByRole('button', { name: '🗑 Remove' }));

    expect(await screen.findByText('✓ Highlight removed')).toBeTruthy();
    expect(onDeleteMark).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('dialog', { name: 'Saved passage note' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByText('✓ Highlight removed')).toBeNull());
    expect(onSaveMark).toHaveBeenCalledWith({
      quote: 'beta', prefix: 'Alpha ', suffix: ' gamma', startOffset: 6, endOffset: 10, note: 'why',
    });
  });

  it('reports a failed removal in the card and keeps it open', async () => {
    supportHighlights();
    const onDeleteMark = vi.fn().mockRejectedValue(new Error('down'));
    renderModal({ explanation: { content: TEXT }, marks: [mark], onDeleteMark });

    hover();
    await card();
    fireEvent.click(screen.getByRole('button', { name: '🗑 Remove' }));
    expect(await screen.findByText('Could not remove. Try again.')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Saved passage note' })).toBeTruthy();
  });

  it('reports a failed restore in the removed notice', async () => {
    supportHighlights();
    const onDeleteMark = vi.fn().mockResolvedValue(undefined);
    const onSaveMark = vi.fn().mockRejectedValue(new Error('down'));
    renderModal({ explanation: { content: TEXT }, marks: [mark], onDeleteMark, onSaveMark });

    hover();
    await card();
    fireEvent.click(screen.getByRole('button', { name: '🗑 Remove' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Could not restore.')).toBeTruthy();
    expect(screen.getByText('✓ Highlight removed')).toBeTruthy();
  });

  it('removes a selection that is exactly a saved passage from the selection menu', async () => {
    supportHighlights();
    const onDeleteMark = vi.fn().mockResolvedValue(undefined);
    renderModal({ explanation: { content: TEXT }, marks: [mark], onDeleteMark });

    selectText('beta');
    expect(await screen.findByText('✓ Already saved')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '🗑 Remove' }));

    expect(await screen.findByText('✓ Highlight removed')).toBeTruthy();
    expect(onDeleteMark).toHaveBeenCalledWith(1);
    expect(screen.queryByText('✓ Already saved')).toBeNull();
  });
});

describe('ChapterExplanationModal image panel', () => {
  const images = [1, 2, 3].map(id => ({ id, originalName: `image-${id}.png` }));

  function renderWithImages(props) {
    chapterImageApi.getAll.mockResolvedValue(images);
    const base = {
      chapterId: 7, imageCount: 3, chapterTitle: 'Ch 1', bookTitle: 'Book',
      explanation: { content: TEXT }, onClose: () => {}, onSave: vi.fn(),
    };
    return render(
      <QueryClientProvider client={createQueryClient()}>
        <ChapterExplanationModal {...base} {...props} />
      </QueryClientProvider>,
    );
  }

  const imagesButton = () => screen.getByRole('button', { name: /Images \(3\)|Hide Images/ });

  it('offers the panel only when the chapter has images', () => {
    renderWithImages({ imageCount: 0 });
    expect(screen.queryByRole('button', { name: /Images/ })).toBeNull();
    expect(document.querySelector('.reader-split')).not.toBeNull();
    expect(document.querySelector('.chapter-image-panel')).toBeNull();
  });

  it('opens and closes the panel with the images, and remembers the choice', async () => {
    const { unmount } = renderWithImages();
    expect(document.querySelector('.chapter-image-panel')).toBeNull();

    fireEvent.click(imagesButton());
    expect(await screen.findByText('image-1.png')).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(imagesButton().getAttribute('aria-pressed')).toBe('true');
    expect(imagesButton().textContent).toContain('Hide Images');
    expect(document.querySelector('.review-reader-modal').classList.contains('has-image-panel')).toBe(true);
    expect(localStorage.getItem('explanationReaderImagePanel')).toBe('on');

    unmount();
    renderWithImages();
    expect(await screen.findByText('image-1.png')).toBeTruthy();

    fireEvent.click(imagesButton());
    expect(document.querySelector('.chapter-image-panel')).toBeNull();
    expect(localStorage.getItem('explanationReaderImagePanel')).toBe('off');
  });

  it('can be opened while editing', async () => {
    renderWithImages({ startInEdit: true });
    expect(await screen.findByTestId('editor')).toBeTruthy();
    fireEvent.click(imagesButton());
    expect(await screen.findByText('image-1.png')).toBeTruthy();
  });

  it('still offers to save a passage selected in the text', async () => {
    localStorage.setItem('explanationReaderImagePanel', 'on');
    renderWithImages({ onSaveMark: vi.fn().mockResolvedValue({ id: 1 }) });
    await screen.findByText('image-1.png');

    selectText('beta gamma');
    expect(await screen.findByRole('button', { name: '📑 Save passage' })).toBeTruthy();
  });

  it('switches images with the arrow keys only while focus is in the panel', async () => {
    localStorage.setItem('explanationReaderImagePanel', 'on');
    renderWithImages();
    await screen.findByText('image-1.png');

    fireEvent.keyDown(document.querySelector('.review-reader-content'), { key: 'ArrowRight' });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Next image' }), { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next image' }), { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('resizes the panel from the separator within bounds and remembers the width', async () => {
    localStorage.setItem('explanationReaderImagePanel', 'on');
    renderWithImages();
    const separator = await screen.findByRole('separator');
    const split = () => document.querySelector('.reader-split').style.getPropertyValue('--image-panel-ratio');
    expect(split()).toBe('0.4');

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(split()).toBe('0.45');
    expect(localStorage.getItem('explanationReaderImagePanelRatio')).toBe('0.45');

    for (let i = 0; i < 10; i += 1) fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(Number(split())).toBeCloseTo(0.65);
    for (let i = 0; i < 20; i += 1) fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(Number(split())).toBeCloseTo(0.25);
  });

  it('closes only the lightbox on Esc, then leaves fullscreen, then closes the reader', async () => {
    localStorage.setItem('explanationReaderImagePanel', 'on');
    const onClose = vi.fn();
    renderWithImages({ onClose });
    await screen.findByText('image-1.png');
    const modal = () => document.querySelector('.review-reader-modal');

    fireEvent.click(screen.getByRole('button', { name: '⛶ Fullscreen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }));
    expect(screen.getByRole('dialog', { name: 'Image viewer' })).toBeTruthy();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Image viewer' })).toBeNull();
    expect(modal().classList.contains('is-fullscreen')).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(modal().classList.contains('is-fullscreen')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});