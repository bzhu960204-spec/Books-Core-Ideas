import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import AddToCollectionModal from './AddToCollectionModal';
import PickBooksModal from './PickBooksModal';
import { bookApi, bookCollectionApi } from '../../api';
import { createQueryClient } from '../../queries';

vi.mock('../../api', () => ({
  bookApi: { getAll: vi.fn() },
  bookCollectionApi: { list: vi.fn(), collectionsForBook: vi.fn(), addBook: vi.fn(), removeBook: vi.fn(), create: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const down = () => Object.assign(new Error('Cannot reach the server. Is the backend running?'), { status: 502 });

// Regression (BUG-19): failed loads showed "No collections yet" / "No books found.".
describe('collection pickers when loading fails', () => {
  it('AddToCollectionModal says the collections could not be loaded, and retries', async () => {
    bookCollectionApi.list.mockRejectedValueOnce(down()).mockResolvedValue([{ id: 1, name: 'Favourites', parentId: null, bookCount: 0 }]);
    bookCollectionApi.collectionsForBook.mockResolvedValue([]);
    render(<AddToCollectionModal bookId={3} bookTitle="Book Three" onClose={() => {}} />);

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('Could not load the collections — Cannot reach the server');
    expect(screen.queryByText(/No collections yet/)).toBeNull();

    fireEvent.click(within(error).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Favourites')).toBeTruthy();
  });

  it('PickBooksModal says the books could not be loaded instead of "No books found."', async () => {
    bookApi.getAll.mockRejectedValue(down());
    render(
      <QueryClientProvider client={createQueryClient()}>
        <PickBooksModal folderId={1} existingIds={new Set()} onClose={() => {}} onAdded={() => {}} />
      </QueryClientProvider>,
    );

    expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toContain('Could not load your books');
    expect(screen.queryByText('No books found.')).toBeNull();
  });
});
