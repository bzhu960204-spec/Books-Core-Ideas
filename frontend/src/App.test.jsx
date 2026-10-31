import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { createQueryClient } from './queries';
import { bookDetail, installFakeBackend } from './test/fakeBackend';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

// The first load of a lazy page imports its whole module graph, slow under a parallel test run.
const LAZY = { timeout: 5000 };

const renderApp = (path) => {
  window.history.pushState({}, '', path);
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
};

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
