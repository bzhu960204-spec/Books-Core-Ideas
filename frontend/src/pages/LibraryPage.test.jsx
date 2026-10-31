import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LibraryPage from './LibraryPage';
import { createQueryClient } from '../queries';
import { installFakeBackend } from '../test/fakeBackend';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
