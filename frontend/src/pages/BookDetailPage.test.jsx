import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import BookDetailPage from './BookDetailPage';
import { createQueryClient } from '../queries';
import { bookDetail, installFakeBackend } from '../test/fakeBackend';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn(); // not implemented by jsdom
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function GoTo({ to }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>go {to}</button>;
}

function renderBookPage(path) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <GoTo to="/book/2" />
        <Routes>
          <Route path="/book/:id" element={<BookDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookDetailPage data loading (FE-03)', () => {
  // Regression: the page requested the book, its chapters, and then every chapter's
  // excerpts, explanation ids, bookmarks and marks separately (2 + N + 3 requests).
  it('loads the whole page with one request', async () => {
    const { requests } = installFakeBackend({ details: [bookDetail(1, 'Book One', 5)] });
    renderBookPage('/book/1');

    expect(await screen.findByText('Book One chapter 5')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTitle('Read excerpts')).toHaveLength(5));
    expect(screen.getAllByTitle('View / edit explanation')).toHaveLength(1);

    expect(requests).toEqual(['GET /api/books/1/detail']);
  });

  it('shows the ideas of an expanded chapter without another request', async () => {
    const { requests } = installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderBookPage('/book/1');

    fireEvent.click(await screen.findByText('Book One chapter 2'));

    expect(await screen.findByText('Idea of 102')).toBeTruthy();
    expect(requests).toEqual(['GET /api/books/1/detail']);
  });

  // Regression: a slow response for the previous book could overwrite the new one.
  it('keeps showing the newly opened book when the previous one answers late', async () => {
    let releaseBookOne;
    const bookOneHeld = new Promise(resolve => { releaseBookOne = resolve; });
    installFakeBackend({
      details: [bookDetail(1, 'Book One'), bookDetail(2, 'Book Two')],
      delay: (path) => (path.startsWith('/api/books/1') ? bookOneHeld : null),
    });
    renderBookPage('/book/1');

    fireEvent.click(screen.getByText('go /book/2'));
    expect(await screen.findByRole('heading', { name: 'Book Two' })).toBeTruthy();

    await act(async () => { releaseBookOne(); await bookOneHeld; });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(screen.getByRole('heading', { name: 'Book Two' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Book One' })).toBeNull();
  });
});

describe('BookDetailPage JSON import (FE-08)', () => {
  // Regression: "Replace All" read, deleted and re-created every item with its own
  // request; a failure half-way left the chapter half replaced.
  it('replaces a chapter\'s ideas and excerpts with one import request', async () => {
    const { writes } = installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderBookPage('/book/1');

    fireEvent.click((await screen.findAllByTitle('Import JSON for this chapter'))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ideas + Excerpts' }));
    fireEvent.click(screen.getByRole('button', { name: '↺ Replace All' }));
    const content = { ideas: [{ content: 'New idea' }], excerpts: [{ content: 'New passage', source: 'p.1' }] };
    fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON.stringify(content) } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace All' }));

    expect(await screen.findByText('Imported successfully!')).toBeTruthy();
    expect(writes).toEqual([{
      method: 'POST',
      path: '/api/books/1/import/content',
      body: { mode: 'REPLACE', chapters: [{ chapterId: 101, ...content }] },
    }]);
  });

  it('imports ideas for chapters named by title in one request', async () => {
    const { writes } = installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderBookPage('/book/1');

    fireEvent.click(await screen.findByRole('button', { name: 'Import JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ideas (All)' }));
    const groups = [
      { chapter: 'Book One chapter 1', ideas: [{ content: 'a' }] },
      { chapter: 'Book One chapter 2', ideas: [{ content: 'b' }, { content: 'c' }] },
    ];
    fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON.stringify(groups) } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText('Imported successfully!')).toBeTruthy();
    expect(writes).toEqual([{
      method: 'POST', path: '/api/books/1/import/content', body: { mode: 'ADD', chapters: groups },
    }]);
  });
});
