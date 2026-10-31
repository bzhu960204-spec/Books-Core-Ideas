import { vi } from 'vitest';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const notFound = (path) =>
  new Response(JSON.stringify({ status: 404, detail: `Not found: ${path}` }), {
    status: 404, headers: { 'Content-Type': 'application/problem+json' },
  });

/**
 * A fake backend at the fetch level, serving books described as GET /books/{id}/detail
 * responses: the detail endpoint and every fine-grained endpoint it replaces, so the
 * same test runs against code that uses either. Records every request as "METHOD path"
 * and the bodies of writes. `delay(path)` may return a promise to hold a response back.
 */
export function installFakeBackend({ details = [], ideas = [], delay = () => null } = {}) {
  const requests = [];
  const writes = []; // { method, path, body } of every non-GET request
  let nextId = 9000;
  const byId = new Map(details.map(d => [String(d.book.id), d]));
  const chapters = new Map();
  for (const d of details) for (const c of d.chapters) chapters.set(String(c.id), c);

  const write = (method, path, body) => {
    if (method === 'DELETE') return new Response(null, { status: 204 });
    if (path === '/api/books/import') {
      return json(body.books.map(b => ({ ...b, id: nextId++, chapterCount: (b.chapters || []).length })), 201);
    }
    if (/^\/api\/books\/\d+\/import(\/content)?$/.test(path)) {
      return json({ parts: 0, chapters: 0, ideas: 0, excerpts: 0 });
    }
    // Any other create/update: echo the body with an id, as the real endpoints do.
    return json({ ...body, id: nextId++ }, method === 'POST' ? 201 : 200);
  };

  const route = (method, path, query, body) => {
    let m;
    if (method !== 'GET') return write(method, path, body);
    if (path === '/api/books') return json(details.map(d => d.book));
    if (path === '/api/books/categories') return json([]);
    if (path === '/api/ideas' || path === '/api/excerpts') return json(ideas);
    if (path === '/api/bookmarks') {
      const d = byId.get(query.get('bookId'));
      return json(d ? d.bookmarks : details.flatMap(x => x.bookmarks));
    }
    if ((m = path.match(/^\/api\/books\/(\d+)(\/.*)?$/))) {
      const d = byId.get(m[1]);
      if (!d) return notFound(path);
      switch (m[2]) {
        case undefined: return json(d.book);
        case '/detail': return json(d);
        case '/parts': return json(d.parts);
        case '/marks': return json(d.marks);
        case '/chapters':
          return json(d.chapters.map(({ id, title, orderIndex, summary, partId, keyIdeas }) =>
            ({ id, title, orderIndex, summary, partId, keyIdeas })));
        case '/explanation-chapter-ids': return json(d.chapters.filter(c => c.hasExplanation).map(c => c.id));
        case '/export': return json({ title: d.book.title, chapters: [] });
        default: return notFound(path);
      }
    }
    if ((m = path.match(/^\/api\/chapters\/(\d+)\/explanation$/))) {
      const c = chapters.get(m[1]);
      if (!c) return notFound(path);
      if (!c.hasExplanation) return new Response(null, { status: 204 });
      return json({ chapterId: c.id, content: `<p>Explanation of ${c.title}</p>`, updatedAt: '2026-01-02' });
    }
    if ((m = path.match(/^\/api\/chapters\/(\d+)\/(ideas|excerpts|images)$/))) {
      const c = chapters.get(m[1]);
      if (!c) return notFound(path);
      if (m[2] === 'ideas') return json(c.keyIdeas);
      if (m[2] === 'excerpts') return json(c.excerpts);
      return json(Array.from({ length: c.imageCount }, (_, i) => ({ id: i + 1, originalName: `${i + 1}.png` })));
    }
    return notFound(path);
  };

  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const parsed = new URL(url, 'http://localhost');
    requests.push(`${method} ${parsed.pathname}${parsed.search}`);
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : undefined;
    if (method !== 'GET') writes.push({ method, path: parsed.pathname, body });
    const hold = delay(parsed.pathname);
    if (hold) await hold;
    return route(method, parsed.pathname, parsed.searchParams, body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, writes };
}

/** A detail response for a CHAPTERS book with `chapterCount` chapters, two excerpts each. */
export function bookDetail(id, title, chapterCount = 3) {
  const chapters = Array.from({ length: chapterCount }, (_, i) => {
    const chapterId = id * 100 + i + 1;
    return {
      id: chapterId, title: `${title} chapter ${i + 1}`, orderIndex: i + 1, summary: null, partId: null,
      keyIdeas: [{ id: chapterId * 10, content: `Idea of ${chapterId}`, example: null, tags: null, highlighted: false, orderIndex: 1 }],
      excerpts: [1, 2].map(n => ({ id: chapterId * 10 + n, content: `Excerpt ${n}`, note: null, source: null, orderIndex: n, highlighted: false })),
      imageCount: 0,
      hasExplanation: i === 0,
    };
  });
  return {
    book: {
      id, title, author: 'Author', isbn: null, description: null, coverUrl: null, dateAdded: '2026-01-01',
      rating: null, category: null, readingStatus: null, startDate: null, finishDate: null,
      chapterImagesEnabled: false, structureType: 'CHAPTERS', chapterCount,
    },
    parts: [],
    chapters,
    bookmarks: [],
    marks: [],
  };
}

/**
 * A PARTS book: part 11 "Part Two" (orderIndex 2, listed first) holds chapter 2,
 * part 12 "Part One" (orderIndex 1) holds chapter 1, and chapter 3 is ungrouped.
 * Every chapter has an explanation.
 */
export function partsBookDetail(id, title) {
  const d = bookDetail(id, title, 3);
  const partOf = [12, 11, null];
  return {
    ...d,
    book: { ...d.book, structureType: 'PARTS' },
    parts: [
      { id: 11, title: 'Part Two', orderIndex: 2, summary: null },
      { id: 12, title: 'Part One', orderIndex: 1, summary: null },
    ],
    chapters: d.chapters.map((c, i) => ({ ...c, partId: partOf[i], hasExplanation: true })),
  };
}
