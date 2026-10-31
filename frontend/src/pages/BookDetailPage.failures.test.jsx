// FE-05: a failed write on the book page is reported, and what the user typed or
// chose stays on screen so it can be retried.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookDetailPage from './BookDetailPage';
import Toaster from '../components/feedback/Toaster';
import { clearToasts } from '../components/feedback/toast';
import { createQueryClient } from '../queries';
import { bookDetail, installFakeBackend } from '../test/fakeBackend';

vi.mock('../components/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** `failing` decides which requests fail: (method, path) => status | 'network' | null. */
function renderBook(failing) {
  const backend = installFakeBackend({ details: [bookDetail(1, 'Book One', 2)], fail: failing });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/book/1']}>
        <Routes>
          <Route path="/book/:id" element={<BookDetailPage />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
  return backend;
}

const toast = async () => (await screen.findByRole('alert')).textContent;
const dialog = (title) => screen.getByRole('heading', { name: title }).closest('[role="dialog"]');

describe('book page failures', () => {
  it('keeps the chapter form and its input when saving fails', async () => {
    renderBook((method) => (method === 'POST' ? 500 : null));

    fireEvent.click(await screen.findByRole('button', { name: '+ Add Chapter' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1: Introduction'), { target: { value: 'New chapter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Chapter' }));

    expect(await toast()).toContain('Could not save the chapter — Failed: POST /api/books/1/chapters');
    expect(screen.getByDisplayValue('New chapter')).toBeTruthy();
  });

  it('keeps the confirmation open when a delete fails, and a retry can succeed', async () => {
    let down = true;
    const { writes } = renderBook((method) => (down && method === 'DELETE' ? 409 : null));

    fireEvent.click((await screen.findAllByTitle('Delete chapter'))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await toast()).toContain('Could not delete the chapter — Failed: DELETE /api/books/1/chapters/101');
    expect(screen.getByText(/This cannot be undone/)).toBeTruthy();

    down = false;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText(/This cannot be undone/)).toBeNull());
    expect(writes.filter(w => w.method === 'DELETE')).toHaveLength(2);
  });

  it('says the server cannot be reached when it is down', async () => {
    renderBook((method) => (method === 'PUT' ? 'network' : null));
    fireEvent.click(await screen.findByText('Book One chapter 1'));
    fireEvent.click(screen.getByTitle('Add to Idea Bank'));
    expect(await toast()).toContain('Could not change the highlight — Cannot reach the server. Is the backend running?');
  });

  it('reports a failed JSON export', async () => {
    renderBook((method, path) => (path === '/api/books/1/export' ? 500 : null));
    fireEvent.click(await screen.findByRole('button', { name: '📥 Export JSON' }));
    expect(await toast()).toContain('Could not export the book');
  });

  it('keeps the explanation draft in the editor when saving fails', async () => {
    renderBook((method, path) => (method === 'PUT' && path.endsWith('/explanation') ? 500 : null));

    fireEvent.click(await screen.findByTitle('Add explanation'));
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Draft</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await toast()).toContain('Could not save the explanation');
    expect(screen.getByTestId('editor').value).toBe('<p>Draft</p>');
  });

  it('keeps the explanation open when deleting it fails', async () => {
    renderBook((method, path) => (method === 'DELETE' && path.endsWith('/explanation') ? 500 : null));

    fireEvent.click(await screen.findByTitle('View / edit explanation'));
    expect(await screen.findByText('Explanation of Book One chapter 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '🗑️ Delete' }));
    fireEvent.click(within(dialog('Confirm')).getByRole('button', { name: 'Delete' }));

    expect(await toast()).toContain('Could not delete the explanation');
    expect(screen.getByText('Explanation of Book One chapter 1')).toBeTruthy();
  });
});
