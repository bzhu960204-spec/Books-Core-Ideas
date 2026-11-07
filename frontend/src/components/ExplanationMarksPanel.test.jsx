import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import ExplanationMarksPanel from './ExplanationMarksPanel';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const chapters = [
  { id: 1, title: 'Alpha', orderIndex: 1 },
  { id: 2, title: 'Beta', orderIndex: 2 },
  { id: 3, title: 'Gamma', orderIndex: 3 },
];
const mark = (id, chapterId, extra = {}) => ({
  id, chapterId, chapterTitle: chapters.find(c => c.id === chapterId).title, quote: `quote ${id}`, note: '', createdAt: '2026-01-04T09:00:00', ...extra,
});
const baseMarks = [mark(1, 3), mark(2, 1), mark(3, 1), mark(4, 2)];

function Harness({ initialMarks = baseMarks, onDelete, ...props }) {
  const [marks, setMarks] = useState(initialMarks);
  return (
    <ExplanationMarksPanel
      marks={marks}
      chapters={chapters}
      parts={[]}
      isParts={false}
      onJump={() => {}}
      onUpdateNote={async () => {}}
      onClose={() => {}}
      onDelete={async (id) => { await onDelete?.(id); setMarks(prev => prev.filter(m => m.id !== id)); }}
      {...props}
    />
  );
}

const sidebar = () => within(screen.getByRole('navigation', { name: 'Chapters' }));
const chapterButtons = () => sidebar().getAllByRole('button');
const focusDialog = () => document.querySelector('.passage-focus-modal');
const openFocus = (index) => fireEvent.click(screen.getAllByRole('button', { name: 'Focus on this passage' })[index]);

describe('ExplanationMarksPanel', () => {
  it('lists chapters with passages in book order, with counts, and shows the first one', () => {
    render(<Harness />);
    expect(chapterButtons().map(b => b.textContent)).toEqual(['Alpha2', 'Beta1', 'Gamma1']);
    expect(chapterButtons()[0].getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByText('2 passages')).toBeTruthy();
    expect(screen.getByText('quote 2')).toBeTruthy();
    expect(screen.queryByText('quote 4')).toBeNull();
  });

  it('starts on the remembered chapter, or the first one when it has no passages left', () => {
    const { unmount } = render(<Harness initialChapterId={3} />);
    expect(screen.getByRole('heading', { name: 'Gamma' })).toBeTruthy();
    unmount();
    render(<Harness initialChapterId={42} />);
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
  });

  it('switches chapter on click and reports it', () => {
    const onChapterChange = vi.fn();
    render(<Harness onChapterChange={onChapterChange} />);
    fireEvent.click(chapterButtons()[1]);
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeTruthy();
    expect(screen.getByText('quote 4')).toBeTruthy();
    expect(screen.queryByText('quote 2')).toBeNull();
    expect(chapterButtons()[1].getAttribute('aria-current')).toBe('true');
    expect(onChapterChange).toHaveBeenLastCalledWith(2);
  });

  it('moves to the next chapter after the last passage of a chapter is deleted', async () => {
    render(<Harness initialChapterId={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('heading', { name: 'Confirm' }).closest('[role="dialog"]')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Gamma' })).toBeTruthy());
    expect(chapterButtons().map(b => b.textContent)).toEqual(['Alpha2', 'Gamma1']);
  });

  it('moves to the previous chapter when the last chapter empties, then shows the empty state', async () => {
    render(<Harness initialMarks={[mark(1, 1), mark(2, 3)]} initialChapterId={3} />);
    const confirmDelete = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      fireEvent.click(within(screen.getByRole('heading', { name: 'Confirm' }).closest('[role="dialog"]')).getByRole('button', { name: 'Delete' }));
    };
    confirmDelete();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy());
    confirmDelete();
    expect(await screen.findByText('No saved passages yet.')).toBeTruthy();
  });

  it('closes the focus dialog when the chapter changes', () => {
    render(<Harness />);
    openFocus(1);
    expect(focusDialog()).not.toBeNull();
    fireEvent.click(chapterButtons()[1]);
    expect(focusDialog()).toBeNull();
    fireEvent.click(chapterButtons()[0]);
    expect(focusDialog()).toBeNull();
  });

  it('jumps to a passage and saves a note from the focus dialog', async () => {
    const onJump = vi.fn();
    const onUpdateNote = vi.fn(async () => {});
    render(<Harness onJump={onJump} onUpdateNote={onUpdateNote} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Jump to' })[1]);
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Add note' })[0]);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: ' why ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(onUpdateNote).toHaveBeenCalledWith(2, 'why'));
    expect(await screen.findByText('Saved ✓')).toBeTruthy();
    expect(focusDialog()).not.toBeNull();
  });

  it('shows an error and keeps the draft when the note cannot be saved', async () => {
    render(<Harness onUpdateNote={async () => { throw new Error('x'); }} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add note' })[0]);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save the note. Try again.');
    expect(screen.getByLabelText('Note').value).toBe('draft');
  });

  it('maximizes, remembers the choice and restores', () => {
    const { unmount } = render(<Harness />);
    expect(document.querySelector('.marks-modal').classList.contains('is-maximized')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(document.querySelector('.marks-modal').classList.contains('is-maximized')).toBe(true);
    expect(localStorage.getItem('savedPassagesMaximized')).toBe('on');
    unmount();

    render(<Harness />);
    expect(document.querySelector('.marks-modal').classList.contains('is-maximized')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(document.querySelector('.marks-modal').classList.contains('is-maximized')).toBe(false);
    expect(localStorage.getItem('savedPassagesMaximized')).toBe('off');
  });

  it('closes the panel on Esc even when maximized', () => {
    localStorage.setItem('savedPassagesMaximized', 'on');
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the focus dialog from the quote, by click or keyboard, but not while selecting text', () => {
    render(<Harness />);
    const quote = () => screen.getAllByRole('button', { name: 'Focus on this passage' })[0];

    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'quo',
      anchorNode: quote().firstChild,
    });
    fireEvent.click(quote());
    expect(focusDialog()).toBeNull();
    selection.mockRestore();

    fireEvent.click(quote());
    expect(focusDialog()).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(focusDialog()).toBeNull();

    fireEvent.keyDown(quote(), { key: 'Enter' });
    expect(focusDialog()).not.toBeNull();
  });

  it('opens the focus dialog with the note field focused from Add note', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add note' })[0]);
    expect(document.activeElement).toBe(screen.getByLabelText('Note'));
  });

  it('closes only the focus dialog on Esc', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openFocus(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(focusDialog()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scrolls the last viewed passage into view after the focus dialog closes', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness />);
      openFocus(1);
      fireEvent.click(within(focusDialog()).getByRole('button', { name: 'Next →' }));
      scrollIntoView.mockClear();
      fireEvent.keyDown(document, { key: 'Escape' });
      const item = document.querySelector('[data-mark-id="3"]');
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(item);
      expect(item.classList.contains('mark-flash-block')).toBe(true);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('shows the next passage after deleting from the focus dialog, then the previous, then closes', async () => {
    render(<Harness initialMarks={[mark(1, 1), mark(2, 1), mark(3, 1)]} />);
    const dialogNote = () => within(focusDialog());
    const deleteFromDialog = () => {
      fireEvent.click(dialogNote().getByRole('button', { name: 'Delete' }));
      fireEvent.click(within(screen.getByRole('heading', { name: 'Confirm' }).closest('[role="dialog"]')).getByRole('button', { name: 'Delete' }));
    };

    openFocus(1);
    deleteFromDialog();
    await waitFor(() => expect(dialogNote().getByText('quote 3')).toBeTruthy());
    expect(dialogNote().getByText('Passage 2 of 2')).toBeTruthy();

    deleteFromDialog();
    await waitFor(() => expect(dialogNote().getByText('quote 1')).toBeTruthy());

    deleteFromDialog();
    await waitFor(() => expect(focusDialog()).toBeNull());
    expect(screen.getByText('No saved passages yet.')).toBeTruthy();
  });

  it('flags passages whose position may have changed', () => {
    render(<Harness staleIds={{ 2: true }} />);
    expect(screen.getAllByText('⚠ Position may have changed')).toHaveLength(1);
  });
});
