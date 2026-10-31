import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReviewReaderModal from './ReviewReaderModal';

vi.mock('./RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

afterEach(cleanup);

const reviewA = { id: 1, title: 'First take', content: '<p>Draft one</p>', bookTitle: 'Book' };

function renderModal(props) {
  const base = { onClose: () => {}, onSave: vi.fn(), onDelete: () => {}, onOpenBook: () => {} };
  const utils = render(<ReviewReaderModal {...base} {...props} />);
  return { ...utils, rerender: (next) => utils.rerender(<ReviewReaderModal {...base} {...next} />) };
}

describe('ReviewReaderModal keeps its draft in step with the review prop', () => {
  it('opens in edit mode with the review loaded into the draft', () => {
    renderModal({ review: reviewA, startInEdit: true });
    expect(screen.getByDisplayValue('First take')).toBeTruthy();
    expect(screen.getByTestId('editor').value).toBe('<p>Draft one</p>');
  });

  it('returns to reading mode with the saved review when the parent passes it back', () => {
    const { rerender } = renderModal({ review: reviewA, startInEdit: true });
    fireEvent.change(screen.getByDisplayValue('First take'), { target: { value: 'Typed title' } });

    const saved = { ...reviewA, title: 'Saved title', content: '<p>Saved body</p>' };
    rerender({ review: saved, startInEdit: false });

    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Saved title' })).toBeTruthy();
    expect(screen.getByText('Saved body')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(screen.getByDisplayValue('Saved title')).toBeTruthy();
    expect(screen.getByTestId('editor').value).toBe('<p>Saved body</p>');
  });

  it('keeps unsaved edits when the parent re-renders with the same review', () => {
    const { rerender } = renderModal({ review: reviewA, startInEdit: true });
    fireEvent.change(screen.getByDisplayValue('First take'), { target: { value: 'Typed title' } });
    fireEvent.change(screen.getByTestId('editor'), { target: { value: '<p>typed</p>' } });

    rerender({ review: reviewA, startInEdit: true, saving: true });

    expect(screen.getByDisplayValue('Typed title')).toBeTruthy();
    expect(screen.getByTestId('editor').value).toBe('<p>typed</p>');
  });

  it('loads a different review into the draft', () => {
    const { rerender } = renderModal({ review: reviewA, startInEdit: true });
    fireEvent.change(screen.getByDisplayValue('First take'), { target: { value: 'Typed title' } });

    rerender({ review: { id: 2, title: 'Other', content: '<p>Other body</p>', bookTitle: 'B' }, startInEdit: true });

    expect(screen.getByDisplayValue('Other')).toBeTruthy();
    expect(screen.getByTestId('editor').value).toBe('<p>Other body</p>');
  });
});
