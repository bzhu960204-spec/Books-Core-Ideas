import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ReviewBankPage from './ReviewBankPage';
import Toaster from '../components/feedback/Toaster';
import { clearToasts } from '../components/feedback/toast';
import { bookApi, reviewApi } from '../api';
import { createQueryClient } from '../queries';

vi.mock('../components/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

vi.mock('../api', () => ({
  bookApi: { getAll: vi.fn() },
  reviewApi: { getAll: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));

afterEach(() => {
  cleanup();
  clearToasts();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// updatedAt is a date-time since DB-06; the page shows its day.
const REVIEW = { id: 7, bookId: 3, bookTitle: 'Book Three', title: 'My take', content: '<p>Stored</p>', updatedAt: '2026-10-01T09:30:15.123456' };

function renderPage() {
  bookApi.getAll.mockResolvedValue([{ id: 3, title: 'Book Three' }]);
  reviewApi.getAll.mockResolvedValue([REVIEW]);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter><ReviewBankPage /></MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe('ReviewBankPage edit dates', () => {
  it('shows the day a review was last edited, on the card and in the reader', async () => {
    renderPage();

    const heading = await screen.findByRole('heading', { name: 'My take' });
    expect(screen.getAllByText('2026-10-01')).toHaveLength(1);
    fireEvent.click(heading);

    expect(await screen.findByRole('button', { name: '✏️ Edit' })).toBeTruthy();
    expect(screen.getAllByText('2026-10-01')).toHaveLength(2);
    expect(screen.queryByText(/T09:30/)).toBeNull();
  });
});

describe('ReviewBankPage saving a review', () => {
  // Regression (BUG-17): the page swallowed the error and the reader left edit
  // mode as if saved, showing the old text; closing it lost the edits.
  it('stays in the editor with the draft and says why when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reviewApi.update.mockRejectedValue(new Error('title: size must be between 0 and 255'));
    renderPage();

    fireEvent.click(await screen.findByRole('heading', { name: 'My take' }));
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit' }));
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Edited</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Could not save the review — title: size must be between 0 and 255');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false));
    expect(screen.getByTestId('editor').value).toBe('<p>Edited</p>');
  });

  it('returns to reading mode after a successful save', async () => {
    reviewApi.update.mockResolvedValue({ ...REVIEW, content: '<p>Edited</p>' });
    renderPage();

    fireEvent.click(await screen.findByRole('heading', { name: 'My take' }));
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit' }));
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Edited</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByTestId('editor')).toBeNull());
    expect(reviewApi.update).toHaveBeenCalledWith(3, 7, { title: 'My take', content: '<p>Edited</p>' });
  });
});
