import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PassageFocusDialog from './PassageFocusDialog';

afterEach(cleanup);

const marks = [
  { id: 1, quote: 'first quote', prefix: 'before one ', suffix: ' after one', note: '', createdAt: '2026-01-04T09:00:00' },
  { id: 2, quote: 'second quote', prefix: '', suffix: '', note: 'old note', createdAt: '2026-01-04T09:00:00' },
  { id: 3, quote: 'third quote', prefix: '', suffix: '', note: '', createdAt: '2026-01-04T09:00:00' },
];

function setup(markId = 1, props = {}) {
  const handlers = {
    onNavigate: vi.fn(),
    onSaveNote: vi.fn(async () => {}),
    onJump: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(
    <PassageFocusDialog marks={marks} markId={markId} chapterTitle="Alpha" {...handlers} {...props} />,
  );
  return { ...handlers, ...view };
}

const note = () => screen.getByLabelText('Note');
const type = (value) => fireEvent.change(note(), { target: { value } });
const button = (name) => screen.getByRole('button', { name });

describe('PassageFocusDialog', () => {
  it('shows the passage with its context and position', () => {
    setup(1);
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByText('Passage 1 of 3')).toBeTruthy();
    expect(screen.getByText('…before one')).toBeTruthy();
    expect(screen.getByText('first quote')).toBeTruthy();
    expect(screen.getByText('after one…')).toBeTruthy();
  });

  it('shows no ellipsis when there is no context', () => {
    setup(2);
    expect(document.querySelector('.passage-focus-context')).toBeNull();
    expect(screen.getByText('second quote')).toBeTruthy();
  });

  it('focuses the note field and starts with the saved note', () => {
    setup(2);
    expect(document.activeElement).toBe(note());
    expect(note().value).toBe('old note');
  });

  it('keeps Save note disabled until the note changes, and saves with Ctrl+Enter', async () => {
    const { onSaveNote } = setup(2);
    expect(button('Save note').disabled).toBe(true);
    type('  new note  ');
    expect(button('Save note').disabled).toBe(false);
    fireEvent.keyDown(note(), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onSaveNote).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 'new note'));
    expect(await screen.findByText('Saved ✓')).toBeTruthy();
    expect(button('Save note').disabled).toBe(true);
  });

  it('lets Enter insert a line break', () => {
    const { onSaveNote } = setup(1);
    fireEvent.keyDown(note(), { key: 'Enter' });
    expect(onSaveNote).not.toHaveBeenCalled();
  });

  it('keeps the draft and shows an error when saving fails', async () => {
    setup(1, { onSaveNote: async () => { throw new Error('x'); } });
    type('draft');
    fireEvent.click(button('Save note'));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save the note. Try again.');
    expect(note().value).toBe('draft');
  });

  it('disables Previous at the start and Next at the end', () => {
    const { unmount } = setup(1);
    expect(button('← Previous').disabled).toBe(true);
    expect(button('Next →').disabled).toBe(false);
    unmount();
    setup(3);
    expect(button('← Previous').disabled).toBe(false);
    expect(button('Next →').disabled).toBe(true);
  });

  it('navigates without asking when there is nothing unsaved', () => {
    const { onNavigate } = setup(2);
    fireEvent.click(button('Next →'));
    expect(onNavigate).toHaveBeenCalledWith(3);
    fireEvent.click(button('← Previous'));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('asks before leaving with an unsaved draft; Cancel stays, Discard continues', () => {
    const { onNavigate, onClose, onJump, onDelete } = setup(2);
    type('changed');

    fireEvent.click(button('Next →'));
    expect(screen.getByRole('heading', { name: 'Unsaved note' })).toBeTruthy();
    expect(screen.getByText('Discard the changes to this note?')).toBeTruthy();
    fireEvent.click(button('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Unsaved note' })).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(note().value).toBe('changed');

    fireEvent.click(button('Jump to'));
    fireEvent.click(button('Cancel'));
    fireEvent.click(button('Delete'));
    fireEvent.click(button('Cancel'));
    fireEvent.click(button('Close'));
    fireEvent.click(button('Cancel'));
    expect(onJump).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(button('Next →'));
    fireEvent.click(button('Discard'));
    expect(onNavigate).toHaveBeenCalledWith(3);
  });

  it('asks on Esc when there is an unsaved draft, and closes after Discard', () => {
    const { onClose } = setup(1);
    type('changed');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Unsaved note' })).toBeTruthy();
    fireEvent.click(button('Discard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not treat whitespace-only changes as unsaved', () => {
    const { onClose } = setup(2);
    type('old note   ');
    fireEvent.click(button('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes Jump to and Delete through when there is nothing unsaved', () => {
    const { onJump, onDelete } = setup(2);
    fireEvent.click(button('Jump to'));
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    fireEvent.click(button('Delete'));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it('switches passages with the arrow keys unless typing in the note', () => {
    const { onNavigate } = setup(2);
    fireEvent.keyDown(note(), { key: 'ArrowRight' });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenLastCalledWith(1);
  });

  it('resets the draft when another passage is shown', () => {
    const { rerender, onNavigate, onSaveNote, onJump, onDelete, onClose } = setup(1);
    type('half written');
    rerender(
      <PassageFocusDialog
        marks={marks}
        markId={2}
        chapterTitle="Alpha"
        onNavigate={onNavigate}
        onSaveNote={onSaveNote}
        onJump={onJump}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );
    expect(note().value).toBe('old note');
  });
});
