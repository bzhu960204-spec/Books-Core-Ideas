import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ChapterExplanationModal from './ChapterExplanationModal';

vi.mock('./RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

afterEach(cleanup);

function renderModal(props) {
  const base = { chapterTitle: 'Ch 1', bookTitle: 'Book', onClose: () => {}, onSave: vi.fn() };
  const utils = render(<ChapterExplanationModal {...base} {...props} />);
  return { ...utils, rerender: (next) => utils.rerender(<ChapterExplanationModal {...base} {...next} />) };
}

describe('ChapterExplanationModal keeps its draft in step with the explanation prop', () => {
  it('starts in edit mode with an empty draft when there is no explanation yet', () => {
    renderModal({ explanation: null });
    expect(screen.getByTestId('editor').value).toBe('');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('opens an existing explanation for reading with the draft preloaded', () => {
    renderModal({ explanation: { content: '<p>Existing</p>' } });
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByText('Existing')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(screen.getByTestId('editor').value).toBe('<p>Existing</p>');
  });

  it('shows the saved explanation in reading mode once the parent passes it back', () => {
    const { rerender } = renderModal({ explanation: null });
    fireEvent.change(screen.getByTestId('editor'), { target: { value: '<p>Typed</p>' } });

    rerender({ explanation: { content: '<p>Saved</p>' } });

    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('keeps unsaved edits when the parent re-renders with the same explanation', () => {
    const explanation = { content: '<p>Existing</p>' };
    const { rerender } = renderModal({ explanation, startInEdit: true });
    fireEvent.change(screen.getByTestId('editor'), { target: { value: '<p>Typed</p>' } });

    rerender({ explanation, startInEdit: true, saving: true });

    expect(screen.getByTestId('editor').value).toBe('<p>Typed</p>');
  });
});
