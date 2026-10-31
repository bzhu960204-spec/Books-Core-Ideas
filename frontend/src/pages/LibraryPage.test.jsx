import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LibraryPage from './LibraryPage';
import Toaster from '../components/feedback/Toaster';
import { clearToasts } from '../components/feedback/toast';
import { createQueryClient } from '../queries';
import { bookDetail, installFakeBackend } from '../test/fakeBackend';

afterEach(() => {
  cleanup();
  clearToasts();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const BOOK = {
  title: 'Imported',
  author: 'A',
  chapters: [{
    title: 'Chapter 1',
    orderIndex: 1,
    keyIdeas: [{ content: 'An idea', orderIndex: 1 }],
    excerpts: [{ content: 'A memorable passage', note: 'Why it matters', source: 'p.42', orderIndex: 1 }],
  }],
};

describe('LibraryPage JSON import (FE-08)', () => {
  // Regression (BUG-06): the browser created the book piece by piece and never sent
  // the chapters' excerpts anywhere they were stored.
  it('sends the whole book, excerpts included, in one import request', async () => {
    const { writes } = installFakeBackend();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter><LibraryPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Import JSON/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON.stringify(BOOK) } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText('Imported successfully!')).toBeTruthy();
    expect(writes).toEqual([{ method: 'POST', path: '/api/books/import', body: { books: [BOOK] } }]);
  });
});

describe('LibraryPage failures (FE-05)', () => {
  const renderLibrary = (fail) => {
    installFakeBackend({ details: [bookDetail(1, 'Book One', 1)], fail });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter><LibraryPage /></MemoryRouter>
        <Toaster />
      </QueryClientProvider>,
    );
  };

  it('reports a failed delete and keeps the confirmation open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLibrary((method) => (method === 'DELETE' ? 500 : null));

    fireEvent.click(await screen.findByTitle('Delete'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete the book — Failed: DELETE /api/books/1');
    expect(screen.getByText(/Are you sure you want to delete "Book One"/)).toBeTruthy();
  });

  it('reports a failed rating', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLibrary((method) => (method === 'PUT' ? 'network' : null));

    fireEvent.click((await screen.findAllByTitle('Rate 4 stars'))[0]);
    expect((await screen.findByRole('alert')).textContent).toContain('Could not change the rating — Cannot reach the server');
  });
});
