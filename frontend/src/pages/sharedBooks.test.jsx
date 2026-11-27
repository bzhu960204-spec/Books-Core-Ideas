import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import LibraryPage from './LibraryPage';
import ReadingHistoryPage from './ReadingHistoryPage';
import FavoritesPage from './FavoritesPage';
import { createQueryClient } from '../queries';
import { bookDetail, installFakeBackend } from '../test/fakeBackend';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Regression (FE-03): every page fetched the whole book list again on each visit.
describe('shared book list', () => {
  it('is fetched once while moving between pages that use it', async () => {
    const { requests } = installFakeBackend({ details: [bookDetail(1, 'Book One'), bookDetail(2, 'Book Two')] });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <nav>
            <Link to="/">library</Link>
            <Link to="/history">history</Link>
            <Link to="/favorites">favorites</Link>
          </nav>
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/history" element={<ReadingHistoryPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Book Two')).toBeTruthy();
    fireEvent.click(screen.getByText('history'));
    expect(await screen.findByRole('heading', { name: /Reading History/ })).toBeTruthy();
    fireEvent.click(screen.getByText('favorites'));
    expect(await screen.findByRole('heading', { name: /Favorite Chapters/ })).toBeTruthy();
    fireEvent.click(screen.getByText('library'));
    expect(await screen.findByText('Book Two')).toBeTruthy();

    expect(requests.filter(r => r === 'GET /api/books')).toHaveLength(1);
  });
});
