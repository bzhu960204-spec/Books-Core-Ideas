import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import FavoritesPage from './FavoritesPage';
import { createQueryClient } from '../queries';
import { bookDetail, installFakeBackend } from '../test/fakeBackend';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function BookRoute() {
  const location = useLocation();
  return <div data-testid="book-page">{location.pathname} {JSON.stringify(location.state)}</div>;
}

// Book 2 "Zeta" (favorites: chapters 2 and 1) is listed before book 1 "Alpha" (chapter 3).
function renderPage() {
  const zeta = bookDetail(2, 'Zeta', 2);
  const alpha = bookDetail(1, 'Alpha', 3);
  zeta.chapters[1].favorite = true;
  zeta.chapters[1].hasExplanation = true;
  zeta.chapters[1].favoriteNote = 'the turning point';
  zeta.chapters[0].favorite = true;
  alpha.chapters[2].favorite = true;
  const backend = installFakeBackend({ details: [zeta, alpha] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/favorites']}>
        <Routes>
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/book/:id" element={<BookRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return backend;
}

const chapterTitles = () => screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);

describe('FavoritesPage', () => {
  it('lists favorite chapters of every book, newest first or grouped by book', async () => {
    renderPage();

    expect(await screen.findByText('the turning point')).toBeTruthy();
    expect(chapterTitles()).toEqual(['1Zeta chapter 1', '2Zeta chapter 2', '3Alpha chapter 3No explanation']);
    expect(screen.getByText('3 chapters')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'book' } });

    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Alpha', 'Zeta']);
    expect(chapterTitles()).toEqual(['3Alpha chapter 3No explanation', '1Zeta chapter 1', '2Zeta chapter 2']);
  });

  it('opens the chapter explanation in its book', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('heading', { name: /Zeta chapter 2/ }));

    expect((await screen.findByTestId('book-page')).textContent)
      .toBe('/book/2 {"openExplanation":{"chapterId":202,"scrollRatio":0}}');
  });

  it('edits the note and removes a favorite after confirming', async () => {
    const { writes } = renderPage();

    const card = (await screen.findByRole('heading', { name: /Zeta chapter 1/ })).closest('article');
    fireEvent.click(within(card).getByTitle('Add a note'));
    fireEvent.change(within(card).getByRole('textbox', { name: 'Note' }), { target: { value: 'read before exams' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save note' }));

    await waitFor(() => expect(writes).toEqual([
      { method: 'PUT', path: '/api/chapters/201/favorite', body: { note: 'read before exams' } }]));
    expect(await screen.findByText('read before exams')).toBeTruthy();

    fireEvent.click(within(card).getByTitle('Remove from Favorite Chapters'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(writes[1]).toEqual({ method: 'DELETE', path: '/api/chapters/201/favorite', body: undefined }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Zeta chapter 1/ })).toBeNull());
    expect(screen.getByText('2 chapters')).toBeTruthy();
  });

  it('searches on the server', async () => {
    const { requests } = renderPage();
    await screen.findByText('the turning point');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search favorite chapters' }), { target: { value: 'turning' } });

    await waitFor(() => expect(requests).toContain('GET /api/favorites?q=turning'));
  });
});
