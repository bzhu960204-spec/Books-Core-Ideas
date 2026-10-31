import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { createQueryClient } from './queries';
import { clearToasts } from './components/feedback/toast';
import { bookDetail, installFakeBackend } from './test/fakeBackend';

// A page that throws while rendering (FE-05).
vi.mock('./pages/ReadingHistoryPage', () => ({
  default: function BrokenPage() { throw new Error('History exploded'); },
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

// The first load of a lazy page imports its whole module graph, slow under a parallel test run.
// The test's own timeout (5 s by default) must leave room for it too.
const LAZY = { timeout: 10000 };
vi.setConfig({ testTimeout: 15000 });

const renderApp = (path) => {
  window.history.pushState({}, '', path);
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
};

const main = () => document.querySelector('main');

// FE-04: every page but the library is loaded on first use.
describe('App routes', () => {
  it('opens a lazily loaded page directly from its URL', async () => {
    installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderApp('/book/1');
    expect(await screen.findByRole('heading', { name: 'Book One' }, LAZY)).toBeTruthy();
  });

  it('loads the next page when navigating from the library', async () => {
    installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderApp('/');
    expect(await screen.findByText('Book One')).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: /Idea Bank/ }));
    expect(await screen.findByRole('heading', { name: /Idea Bank/ }, LAZY)).toBeTruthy();
  });
});

// FE-05: addresses with nothing behind them.
describe('not found', () => {
  it('shows "Page not found" for an unknown address, with the way back', async () => {
    installFakeBackend();
    renderApp('/no/such/page');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(within(main()).getByRole('link', { name: '← Back to Library' }).getAttribute('href')).toBe('/');
  });

  it('rejects a book address that is not a number without asking the server', () => {
    const { requests } = installFakeBackend();
    renderApp('/book/abc');
    expect(screen.getByRole('heading', { name: 'Book not found' })).toBeTruthy();
    expect(requests.filter(r => r.startsWith('GET /api/books/abc'))).toEqual([]);
  });

  it('shows "Book not found" for a book that does not exist', async () => {
    installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderApp('/book/999');
    expect(await screen.findByRole('heading', { name: 'Book not found' }, LAZY)).toBeTruthy();
    expect(screen.getByText('This book does not exist. It may have been deleted.')).toBeTruthy();
  });

  it('tells a failed load apart from a missing book, and retries it', async () => {
    let down = true;
    installFakeBackend({
      details: [bookDetail(1, 'Book One', 2)],
      fail: (method, path) => (down && path === '/api/books/1/detail' ? 500 : null),
    });
    renderApp('/book/1');

    const error = await screen.findByRole('alert', {}, LAZY);
    expect(error.textContent).toContain('Could not load the book — Failed: GET /api/books/1/detail');
    expect(screen.queryByRole('heading', { name: 'Book not found' })).toBeNull();

    down = false;
    fireEvent.click(within(error).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Book One' })).toBeTruthy();
  });
});

// FE-05: a page that throws doesn't blank the app.
describe('error boundary', () => {
  it('shows an error screen in the main area; the sidebar still works and leaving clears it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installFakeBackend({ details: [bookDetail(1, 'Book One', 2)] });
    renderApp('/history');

    expect(await screen.findByRole('heading', { name: 'Something went wrong' }, LAZY)).toBeTruthy();
    expect(screen.getByText(/History exploded/)).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: /My Library/ }));
    expect(await screen.findByText('Book One')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Something went wrong' })).toBeNull();
  });
});
