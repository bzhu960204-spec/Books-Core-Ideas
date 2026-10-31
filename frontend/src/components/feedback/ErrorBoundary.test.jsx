import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const chunk = vi.hoisted(() => ({ reloading: false }));
vi.mock('../../chunkReload', async (importOriginal) => ({
  ...(await importOriginal()),
  isReloadingForChunk: () => chunk.reloading,
}));

afterEach(() => {
  cleanup();
  chunk.reloading = false;
  vi.restoreAllMocks();
});

function Thrower({ error }) {
  if (error) throw error;
  return <p>Page content</p>;
}

// React logs every caught error; keep the test output readable.
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('ErrorBoundary', () => {
  it('shows an error screen instead of a blank page, and Try again renders the page again', () => {
    quiet();
    const { rerender } = render(<ErrorBoundary><Thrower error={new Error('boom')} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
    expect(screen.getByText(/boom/)).toBeTruthy();

    rerender(<ErrorBoundary><Thrower error={null} /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Page content')).toBeTruthy();
  });

  it('clears the error when the reset key changes (the next page)', () => {
    quiet();
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Thrower error={new Error('boom')} /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();
    rerender(<ErrorBoundary resetKey="/b"><Thrower error={null} /></ErrorBoundary>);
    expect(screen.getByText('Page content')).toBeTruthy();
  });

  it('offers a reload when a lazily loaded chunk is missing', () => {
    quiet();
    const error = new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/ReadingHistoryPage-abc.js');
    render(<ErrorBoundary><Thrower error={error} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'This page could not be loaded' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows only "Reloading" while the chunk reload is already under way', () => {
    quiet();
    chunk.reloading = true;
    render(<ErrorBoundary><Thrower error={new TypeError("Cannot read properties of undefined (reading 'default')")} /></ErrorBoundary>);
    expect(screen.getByText('Reloading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
