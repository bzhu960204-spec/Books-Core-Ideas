import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CollectionsExplorer from './CollectionsExplorer';
import Toaster from '../feedback/Toaster';
import { clearToasts } from '../feedback/toast';
import { bookCollectionApi } from '../../api';
import { createQueryClient } from '../../queries';

vi.mock('../../api', () => ({
  bookCollectionApi: {
    list: vi.fn(),
    booksIn: vi.fn(async () => []),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    addBook: vi.fn(),
    removeBook: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  clearToasts();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const FOLDERS = [{ id: 1, name: 'Favourites', parentId: null, bookCount: 0 }];

function renderExplorer() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter><CollectionsExplorer /></MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

// FE-05: the app's own confirmation and toasts instead of window.confirm / alert.
describe('CollectionsExplorer feedback', () => {
  it('asks with the app\'s confirmation before deleting a collection', async () => {
    bookCollectionApi.list.mockResolvedValue(FOLDERS);
    bookCollectionApi.remove.mockResolvedValue(null);
    const confirm = vi.spyOn(window, 'confirm');
    renderExplorer();

    fireEvent.click(await screen.findByTitle('Delete'));
    expect(screen.getByText('Delete collection “Favourites” and all its sub-folders? Books are not deleted, only un-filed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(bookCollectionApi.remove).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText(/Delete collection/)).toBeNull());
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reports a failed delete and keeps the confirmation open', async () => {
    bookCollectionApi.list.mockResolvedValue(FOLDERS);
    bookCollectionApi.remove.mockRejectedValue(new Error('Collection not found: 1'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderExplorer();

    fireEvent.click(await screen.findByTitle('Delete'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete the collection — Collection not found: 1');
    expect(screen.getByText(/Delete collection/)).toBeTruthy();
  });

  it('reports a failed create in a toast, keeping the name typed', async () => {
    bookCollectionApi.list.mockResolvedValue([]);
    bookCollectionApi.create.mockRejectedValue(new Error('name: size must be between 1 and 120'));
    const alert = vi.spyOn(window, 'alert');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderExplorer();

    fireEvent.click(await screen.findByRole('button', { name: '＋ New' }));
    fireEvent.change(screen.getByPlaceholderText('Collection name'), { target: { value: 'Reading list' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not create the collection — name: size must be between 1 and 120');
    expect(screen.getByDisplayValue('Reading list')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
  });
});
