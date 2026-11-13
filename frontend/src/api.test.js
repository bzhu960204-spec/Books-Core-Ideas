import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bookApi, bookCollectionApi, bookmarkApi, chapterApi, chapterImageApi, excerptApi, excerptBankApi,
  explanationApi, ideaApi, ideaBankApi, importApi, markApi, migrationApi, partApi, reviewApi,
} from './api';

afterEach(() => vi.unstubAllGlobals());

const respond = (status, body = '', type = 'application/problem+json') =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': type } })));

// FE-07 characterization: exactly what each call sends (must hold before and after
// the boilerplate refactor). [call, method, url, JSON body | FormData entries | undefined]
const JSON_CALLS = [
  [() => bookApi.getAll(), 'GET', '/api/books'],
  [() => bookApi.detail(3), 'GET', '/api/books/3/detail'],
  [() => bookApi.getCategories(), 'GET', '/api/books/categories'],
  [() => bookApi.create({ title: 't' }), 'POST', '/api/books', { title: 't' }],
  [() => bookApi.update(3, { title: 't' }), 'PUT', '/api/books/3', { title: 't' }],
  [() => bookApi.delete(3), 'DELETE', '/api/books/3'],
  [() => bookApi.export(3), 'GET', '/api/books/3/export'],
  [() => chapterApi.create(3, { title: 'c' }), 'POST', '/api/books/3/chapters', { title: 'c' }],
  [() => chapterApi.update(3, 4, { title: 'c' }), 'PUT', '/api/books/3/chapters/4', { title: 'c' }],
  [() => chapterApi.reorder(3, [{ id: 4, partId: null, orderIndex: 1 }]), 'PUT', '/api/books/3/chapters/order',
    { chapters: [{ id: 4, partId: null, orderIndex: 1 }] }],
  [() => chapterApi.delete(3, 4), 'DELETE', '/api/books/3/chapters/4'],
  [() => partApi.create(3, { title: 'p' }), 'POST', '/api/books/3/parts', { title: 'p' }],
  [() => partApi.update(3, 5, { title: 'p' }), 'PUT', '/api/books/3/parts/5', { title: 'p' }],
  [() => partApi.delete(3, 5), 'DELETE', '/api/books/3/parts/5'],
  [() => ideaApi.create(4, { content: 'i' }), 'POST', '/api/chapters/4/ideas', { content: 'i' }],
  [() => ideaApi.update(4, 6, { content: 'i' }), 'PUT', '/api/chapters/4/ideas/6', { content: 'i' }],
  [() => ideaApi.delete(4, 6), 'DELETE', '/api/chapters/4/ideas/6'],
  [() => excerptApi.create(4, { content: 'e' }), 'POST', '/api/chapters/4/excerpts', { content: 'e' }],
  [() => excerptApi.update(4, 7, { content: 'e' }), 'PUT', '/api/chapters/4/excerpts/7', { content: 'e' }],
  [() => excerptApi.delete(4, 7), 'DELETE', '/api/chapters/4/excerpts/7'],
  [() => explanationApi.get(4), 'GET', '/api/chapters/4/explanation'],
  [() => explanationApi.save(4, { content: 'x' }), 'PUT', '/api/chapters/4/explanation', { content: 'x' }],
  [() => explanationApi.delete(4), 'DELETE', '/api/chapters/4/explanation'],
  [() => bookmarkApi.create(4), 'POST', '/api/chapters/4/bookmarks', { scrollRatio: null, note: '' }],
  [() => bookmarkApi.create(4, { scrollRatio: 0.5, note: 'n' }), 'POST', '/api/chapters/4/bookmarks', { scrollRatio: 0.5, note: 'n' }],
  [() => bookmarkApi.list(), 'GET', '/api/bookmarks'],
  [() => bookmarkApi.list(3), 'GET', '/api/bookmarks?bookId=3'],
  [() => bookmarkApi.delete(8), 'DELETE', '/api/bookmarks/8'],
  [() => markApi.create(4, { quote: 'q' }), 'POST', '/api/chapters/4/marks', { quote: 'q' }],
  [() => markApi.updateAnchors(4, [{ id: 9, orphaned: true }]), 'PUT', '/api/chapters/4/marks/anchors',
    { marks: [{ id: 9, orphaned: true }] }],
  [() => markApi.updateNote(9, 'n'), 'PATCH', '/api/marks/9', { note: 'n' }],
  [() => markApi.delete(9), 'DELETE', '/api/marks/9'],
  [() => ideaBankApi.search(), 'GET', '/api/ideas'],
  [() => ideaBankApi.search({ q: 'a b&c', bookId: 3, tag: 't' }), 'GET', '/api/ideas?q=a+b%26c&bookId=3&tag=t'],
  [() => excerptBankApi.search(), 'GET', '/api/excerpts'],
  [() => excerptBankApi.search({ q: 'x', bookId: 3 }), 'GET', '/api/excerpts?q=x&bookId=3'],
  [() => chapterImageApi.getAll(4), 'GET', '/api/chapters/4/images'],
  [() => chapterImageApi.delete(4, 10), 'DELETE', '/api/chapters/4/images/10'],
  [() => importApi.books({ books: [] }), 'POST', '/api/books/import', { books: [] }],
  [() => importApi.structure(3, { mode: 'ADD' }), 'POST', '/api/books/3/import', { mode: 'ADD' }],
  [() => importApi.content(3, { mode: 'ADD' }), 'POST', '/api/books/3/import/content', { mode: 'ADD' }],
  [() => reviewApi.getAll(), 'GET', '/api/reviews'],
  [() => reviewApi.create(3, { title: 'r' }), 'POST', '/api/books/3/reviews', { title: 'r' }],
  [() => reviewApi.update(3, 11, { title: 'r' }), 'PUT', '/api/books/3/reviews/11', { title: 'r' }],
  [() => reviewApi.delete(3, 11), 'DELETE', '/api/books/3/reviews/11'],
  [() => bookCollectionApi.list(), 'GET', '/api/book-collections'],
  [() => bookCollectionApi.create('n'), 'POST', '/api/book-collections', { name: 'n', parentId: null }],
  [() => bookCollectionApi.create('n', 12, 2), 'POST', '/api/book-collections', { name: 'n', parentId: 12, sortOrder: 2 }],
  [() => bookCollectionApi.rename(12, 'm'), 'PUT', '/api/book-collections/12', { name: 'm' }],
  [() => bookCollectionApi.move(12, null), 'PUT', '/api/book-collections/12/move', { parentId: null }],
  [() => bookCollectionApi.remove(12), 'DELETE', '/api/book-collections/12'],
  [() => bookCollectionApi.booksIn(12), 'GET', '/api/book-collections/12/books?includeDescendants=false'],
  [() => bookCollectionApi.booksIn(12, true), 'GET', '/api/book-collections/12/books?includeDescendants=true'],
  [() => bookCollectionApi.collectionsForBook(3), 'GET', '/api/book-collections/for-book/3'],
  [() => bookCollectionApi.addBook(12, 3), 'POST', '/api/book-collections/12/books/3'],
  [() => bookCollectionApi.removeBook(12, 3), 'DELETE', '/api/book-collections/12/books/3'],
];

function recordFetch(response = () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } })) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    calls.push({ url, options });
    return response();
  }));
  return calls;
}

describe('api requests (FE-07 characterization)', () => {
  it.each(JSON_CALLS.map(([call, method, url, body]) => [`${method} ${url}`, call, method, url, body]))(
    '%s',
    async (_name, call, method, url, body) => {
      const calls = recordFetch();
      await expect(call()).resolves.toEqual({ ok: true });

      expect(calls).toHaveLength(1);
      const { url: sentUrl, options } = calls[0];
      expect(sentUrl).toBe(url);
      expect(options.method ?? 'GET').toBe(method);
      if (body === undefined) {
        expect(options.body).toBeUndefined();
        expect(options.headers?.['Content-Type']).toBeUndefined();
      } else {
        expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(JSON.parse(options.body)).toEqual(body);
      }
    },
  );

  it('passes the cancellation signal of reads through', async () => {
    const calls = recordFetch();
    const { signal } = new AbortController();
    await bookApi.getAll({ signal });
    await bookCollectionApi.booksIn(12, true, { signal });
    await ideaBankApi.search({ q: 'x' }, { signal });
    expect(calls.map(c => c.options.signal)).toEqual([signal, signal, signal]);
  });

  it('returns null for 204 and empty responses', async () => {
    recordFetch(() => new Response(null, { status: 204 }));
    await expect(explanationApi.get(4)).resolves.toBeNull();
    recordFetch(() => new Response('', { status: 200, headers: { 'Content-Length': '0' } }));
    await expect(bookCollectionApi.addBook(12, 3)).resolves.toBeNull();
  });

  it('uploads files as multipart form data', async () => {
    const calls = recordFetch();
    const a = new File(['a'], 'a.png');
    const b = new File(['b'], 'b.png');
    await chapterImageApi.upload(4, [a, b]);
    await migrationApi.preview(a);
    await migrationApi.import(b);

    expect(calls.map(c => [c.options.method, c.url])).toEqual([
      ['POST', '/api/chapters/4/images'],
      ['POST', '/api/migration/import/preview'],
      ['POST', '/api/migration/import'],
    ]);
    expect(calls.every(c => c.options.body instanceof FormData && c.options.headers === undefined)).toBe(true);
    expect(calls[0].options.body.getAll('files')).toHaveLength(2);
    expect(calls[1].options.body.get('file').name).toBe('a.png');
    expect(calls[2].options.body.get('file').name).toBe('b.png');
  });

  it('uploads many images in sequential batches and merges the reports', async () => {
    let n = 0;
    const calls = recordFetch(() => new Response(
      JSON.stringify({ images: [{ id: ++n }], skipped: [{ name: `s${n}`, reason: 'x' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const files = Array.from({ length: 45 }, (_, i) => new File(['x'], `${i}.png`));
    const result = await chapterImageApi.upload(4, files);

    expect(calls.map(c => c.options.body.getAll('files').length)).toEqual([20, 20, 5]);
    expect(calls[2].options.body.getAll('files')[0].name).toBe('40.png');
    expect(result.images.map(i => i.id)).toEqual([1, 2, 3]);
    expect(result.skipped).toHaveLength(3);
  });

  it('builds image URLs without a request', () => {
    expect(chapterImageApi.getUrl(4, 10)).toBe('/api/chapters/4/images/10/data');
  });

  it('downloads an image as a blob, and fails like any other request', async () => {
    const calls = recordFetch(() => new Response('png-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
    const blob = await chapterImageApi.getBlob(4, 10);

    expect(calls[0].url).toBe('/api/chapters/4/images/10/data');
    expect(calls[0].options.method ?? 'GET').toBe('GET');
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('png-bytes');

    respond(404, JSON.stringify({ status: 404, detail: 'Image not found: 10' }));
    await expect(chapterImageApi.getBlob(4, 10)).rejects.toMatchObject({ message: 'Image not found: 10', status: 404 });
  });

  it('exports books as a ZIP blob with the server\'s file name', async () => {
    const calls = recordFetch(() => new Response('zip-bytes', {
      status: 200,
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="books-export-2026-11-01.zip"' },
    }));
    const { blob, filename } = await migrationApi.exportBooks([1, 2]);

    expect(filename).toBe('books-export-2026-11-01.zip');
    expect(await blob.text()).toBe('zip-bytes');
    expect(calls[0].url).toBe('/api/migration/export');
    expect(calls[0].options.method).toBe('POST');
    expect(calls[0].options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(calls[0].options.body)).toEqual({ bookIds: [1, 2] });

    recordFetch(() => new Response('z', { status: 200 }));
    await expect(migrationApi.exportBooks()).resolves.toMatchObject({ filename: 'books-export.zip' });
  });

  it('reports a failed export like any other request', async () => {
    respond(400, JSON.stringify({ status: 400, detail: 'Book not found: 999' }));
    await expect(migrationApi.exportBooks([999])).rejects.toMatchObject({ message: 'Book not found: 999' });
    respond(500, '', 'text/plain');
    await expect(migrationApi.exportBooks([])).rejects.toThrow('Export failed');
  });

  // The one intended change: the export used its own error handling, without the status.
  it('gives a failed export the HTTP status, like every other request', async () => {
    respond(404, JSON.stringify({ status: 404, detail: 'Book not found: 999' }));
    await expect(migrationApi.exportBooks([999])).rejects.toMatchObject({ status: 404 });
  });
});

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
