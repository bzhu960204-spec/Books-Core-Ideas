// Same-origin by default: the prod jar serves /api, and in dev Vite proxies it
// (see vite.config.js). VITE_API_BASE can still point at an absolute URL.
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Builds a readable message from an error response: the backend returns RFC 7807
// problem JSON ({ title, status, detail }); some endpoints return plain text.
async function errorMessage(res, fallback) {
  const text = await res.text().catch(() => '');
  try {
    const problem = JSON.parse(text);
    if (problem && (problem.detail || problem.title)) return problem.detail || problem.title;
  } catch {
    // not JSON — use the raw text
  }
  return text || fallback || `Request failed: ${res.status}`;
}

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = new Error(await errorMessage(res));
    error.status = res.status;
    throw error;
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

// Reads take an optional { signal } so the data layer (queries.js) can cancel them.
export const bookApi = {
  getAll: (opts) => apiFetch(`${API_BASE}/books`, opts),
  // The book page in one request: book, parts, chapters with ideas/excerpts, bookmarks, marks.
  detail: (id, opts) => apiFetch(`${API_BASE}/books/${id}/detail`, opts),
  getCategories: (opts) => apiFetch(`${API_BASE}/books/categories`, opts),
  create: (book) => apiFetch(`${API_BASE}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  }),
  update: (id, book) => apiFetch(`${API_BASE}/books/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  }),
  delete: (id) => apiFetch(`${API_BASE}/books/${id}`, { method: 'DELETE' }),
  export: (id) => apiFetch(`${API_BASE}/books/${id}/export`),
};

export const chapterApi = {
  create: (bookId, chapter) => apiFetch(`${API_BASE}/books/${bookId}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chapter),
  }),
  update: (bookId, chapterId, chapter) => apiFetch(`${API_BASE}/books/${bookId}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chapter),
  }),
  delete: (bookId, chapterId) => apiFetch(`${API_BASE}/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' }),
};

export const partApi = {
  create: (bookId, part) => apiFetch(`${API_BASE}/books/${bookId}/parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(part),
  }),
  update: (bookId, partId, part) => apiFetch(`${API_BASE}/books/${bookId}/parts/${partId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(part),
  }),
  delete: (bookId, partId) => apiFetch(`${API_BASE}/books/${bookId}/parts/${partId}`, { method: 'DELETE' }),
};

export const ideaApi = {
  create: (chapterId, idea) => apiFetch(`${API_BASE}/chapters/${chapterId}/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  }),
  update: (chapterId, ideaId, idea) => apiFetch(`${API_BASE}/chapters/${chapterId}/ideas/${ideaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  }),
  delete: (chapterId, ideaId) => apiFetch(`${API_BASE}/chapters/${chapterId}/ideas/${ideaId}`, { method: 'DELETE' }),
};

export const excerptApi = {
  create: (chapterId, excerpt) => apiFetch(`${API_BASE}/chapters/${chapterId}/excerpts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(excerpt),
  }),
  update: (chapterId, excerptId, excerpt) => apiFetch(`${API_BASE}/chapters/${chapterId}/excerpts/${excerptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(excerpt),
  }),
  delete: (chapterId, excerptId) => apiFetch(`${API_BASE}/chapters/${chapterId}/excerpts/${excerptId}`, { method: 'DELETE' }),
};

export const explanationApi = {
  get: (chapterId) => apiFetch(`${API_BASE}/chapters/${chapterId}/explanation`),
  save: (chapterId, explanation) => apiFetch(`${API_BASE}/chapters/${chapterId}/explanation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(explanation),
  }),
  delete: (chapterId) => apiFetch(`${API_BASE}/chapters/${chapterId}/explanation`, { method: 'DELETE' }),
};

// Manual reading bookmarks ("I read up to here") on chapter explanations.
export const bookmarkApi = {
  create: (chapterId, { scrollRatio = null, note = '' } = {}) =>
    apiFetch(`${API_BASE}/chapters/${chapterId}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scrollRatio, note }),
    }),
  latest: (bookId) => apiFetch(`${API_BASE}/books/${bookId}/bookmarks/latest`),
  list: (bookId = null, opts) => {
    const qs = bookId ? `?bookId=${bookId}` : '';
    return apiFetch(`${API_BASE}/bookmarks${qs}`, opts);
  },
  delete: (id) => apiFetch(`${API_BASE}/bookmarks/${id}`, { method: 'DELETE' }),
};

// Passages saved from chapter explanations (text + location), listed per book.
export const markApi = {
  create: (chapterId, mark) =>
    apiFetch(`${API_BASE}/chapters/${chapterId}/marks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mark),
    }),
  updateNote: (id, note) =>
    apiFetch(`${API_BASE}/marks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }),
  delete: (id) => apiFetch(`${API_BASE}/marks/${id}`, { method: 'DELETE' }),
};

export const ideaBankApi = {
  search: ({ q = '', bookId = null, tag = '' } = {}, opts) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (bookId) params.set('bookId', bookId);
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    return apiFetch(`${API_BASE}/ideas${qs ? '?' + qs : ''}`, opts);
  },
};

export const excerptBankApi = {
  search: ({ q = '', bookId = null } = {}, opts) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (bookId) params.set('bookId', bookId);
    const qs = params.toString();
    return apiFetch(`${API_BASE}/excerpts${qs ? '?' + qs : ''}`, opts);
  },
};

export const chapterImageApi = {
  getAll: (chapterId, opts) => apiFetch(`${API_BASE}/chapters/${chapterId}/images`, opts),
  upload: (chapterId, files) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return apiFetch(`${API_BASE}/chapters/${chapterId}/images`, {
      method: 'POST',
      body: formData,
    });
  },
  delete: (chapterId, imageId) => apiFetch(`${API_BASE}/chapters/${chapterId}/images/${imageId}`, { method: 'DELETE' }),
  getUrl: (chapterId, imageId) => `${API_BASE}/chapters/${chapterId}/images/${imageId}/data`,
};

// JSON import (FE-08): each call is one server transaction; bodies come from utils/jsonImport.js.
export const importApi = {
  books: (body) => apiFetch(`${API_BASE}/books/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  structure: (bookId, body) => apiFetch(`${API_BASE}/books/${bookId}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  content: (bookId, body) => apiFetch(`${API_BASE}/books/${bookId}/import/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
};

export const migrationApi = {
  // Export selected books (or all when bookIds is empty) as a ZIP archive blob.
  exportBooks: async (bookIds) => {
    const res = await fetch(`${API_BASE}/migration/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookIds: bookIds || [] }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Export failed'));
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return { blob: await res.blob(), filename: match ? match[1] : 'books-export.zip' };
  },
  preview: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`${API_BASE}/migration/import/preview`, { method: 'POST', body: formData });
  },
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`${API_BASE}/migration/import`, { method: 'POST', body: formData });
  },
};

export const reviewApi = {
  getAll: (opts) => apiFetch(`${API_BASE}/reviews`, opts),
  list: (bookId) => apiFetch(`${API_BASE}/books/${bookId}/reviews`),
  create: (bookId, review) => apiFetch(`${API_BASE}/books/${bookId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  }),
  update: (bookId, reviewId, review) => apiFetch(`${API_BASE}/books/${bookId}/reviews/${reviewId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  }),
  delete: (bookId, reviewId) => apiFetch(`${API_BASE}/books/${bookId}/reviews/${reviewId}`, {
    method: 'DELETE',
  }),
};

export const bookCollectionApi = {
  list: (opts) => apiFetch(`${API_BASE}/book-collections`, opts),
  create: (name, parentId = null, sortOrder) => apiFetch(`${API_BASE}/book-collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId, sortOrder }),
  }),
  rename: (id, name) => apiFetch(`${API_BASE}/book-collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }),
  move: (id, parentId) => apiFetch(`${API_BASE}/book-collections/${id}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId }),
  }),
  remove: (id) => apiFetch(`${API_BASE}/book-collections/${id}`, { method: 'DELETE' }),
  booksIn: (id, includeDescendants = false, opts) =>
    apiFetch(`${API_BASE}/book-collections/${id}/books?includeDescendants=${includeDescendants}`, opts),
  collectionsForBook: (bookId) => apiFetch(`${API_BASE}/book-collections/for-book/${bookId}`),
  addBook: (id, bookId) => apiFetch(`${API_BASE}/book-collections/${id}/books/${bookId}`, { method: 'POST' }),
  removeBook: (id, bookId) => apiFetch(`${API_BASE}/book-collections/${id}/books/${bookId}`, { method: 'DELETE' }),
};
