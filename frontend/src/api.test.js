import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookApi, migrationApi } from './api';

afterEach(() => vi.unstubAllGlobals());

const respond = (status, body = '', type = 'application/problem+json') =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': type } })));

// FE-05: every failure carries a message a person can read.
describe('api error messages', () => {
  it('uses the ProblemDetail detail, and keeps the status', async () => {
    respond(404, JSON.stringify({ status: 404, detail: 'Book not found: 999' }));
    await expect(bookApi.detail(999)).rejects.toMatchObject({ message: 'Book not found: 999', status: 404 });
  });

  it('says the server is unreachable when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(bookApi.getAll()).rejects.toThrow('Cannot reach the server. Is the backend running?');
    await expect(migrationApi.exportBooks([])).rejects.toThrow('Cannot reach the server');
  });

  it('says the server is unreachable for the dev proxy\'s empty 502', async () => {
    respond(502, '', 'text/plain');
    await expect(bookApi.getAll()).rejects.toMatchObject({ message: 'Cannot reach the server. Is the backend running?', status: 502 });
  });

  it('lets a cancelled request stay a cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); }));
    await expect(bookApi.getAll()).rejects.toMatchObject({ name: 'AbortError' });
  });
});
