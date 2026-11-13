// Same-origin by default: the prod jar serves /api, and in dev Vite proxies it
// (see vite.config.js). VITE_API_BASE can still point at an absolute URL.
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const SERVER_UNREACHABLE = 'Cannot reach the server. Is the backend running?';

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
  // The dev server's proxy answers an empty 502 when the backend is down.
  if (!text && res.status >= 502 && res.status <= 504) return SERVER_UNREACHABLE;
  return text || fallback || `Request failed: ${res.status}`;
}

// fetch() rejects with a bare TypeError ("Failed to fetch") when the server is unreachable.
async function send(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error(SERVER_UNREACHABLE, { cause: err });
  }
}

// Every call goes through here: a failed response becomes an Error with a readable
// message and the HTTP status (`error.status`).
async function request(path, options, fallback) {
  const res = await send(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const error = new Error(await errorMessage(res, fallback));
    error.status = res.status;
    throw error;
  }
  return res;
}

// JSON response, or null for 204 / an empty body.
async function apiFetch(path, options) {
  const res = await request(path, options);
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

const withJson = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Reads take an optional { signal } so the data layer (queries.js) can cancel them.
const get = (path, opts) => apiFetch(path, opts);
// Without a body: a bare POST (e.g. adding a book to a collection).
const post = (path, body) => apiFetch(path, body === undefined ? { method: 'POST' } : withJson('POST', body));
const put = (path, body) => apiFetch(path, withJson('PUT', body));
const patch = (path, body) => apiFetch(path, withJson('PATCH', body));
const del = (path) => apiFetch(path, { method: 'DELETE' });
const postForm = (path, form) => apiFetch(path, { method: 'POST', body: form });

// "?a=1&b=2" from the params that are set (empty strings, null, 0 and false are left out).
function query(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
  return qs ? `?${qs}` : '';
}

function fileForm(field, files) {
  const form = new FormData();
  for (const file of files) form.append(field, file);
  return form;
}

export const bookApi = {
  getAll: (opts) => get('/books', opts),
  // The book page in one request: book, parts, chapters with ideas/excerpts, bookmarks, marks.
  detail: (id, opts) => get(`/books/${id}/detail`, opts),
  getCategories: (opts) => get('/books/categories', opts),
  create: (book) => post('/books', book),
  update: (id, book) => put(`/books/${id}`, book),
  delete: (id) => del(`/books/${id}`),
  export: (id) => get(`/books/${id}/export`),
};

export const chapterApi = {
  create: (bookId, chapter) => post(`/books/${bookId}/chapters`, chapter),
  update: (bookId, chapterId, chapter) => put(`/books/${bookId}/chapters/${chapterId}`, chapter),
  // Sets the part and position number of several chapters in one transaction:
  // chapters = [{ id, partId, orderIndex }].
  reorder: (bookId, chapters) => put(`/books/${bookId}/chapters/order`, { chapters }),
  delete: (bookId, chapterId) => del(`/books/${bookId}/chapters/${chapterId}`),
};

export const partApi = {
  create: (bookId, part) => post(`/books/${bookId}/parts`, part),
  update: (bookId, partId, part) => put(`/books/${bookId}/parts/${partId}`, part),
  delete: (bookId, partId) => del(`/books/${bookId}/parts/${partId}`),
};

export const ideaApi = {
  create: (chapterId, idea) => post(`/chapters/${chapterId}/ideas`, idea),
  update: (chapterId, ideaId, idea) => put(`/chapters/${chapterId}/ideas/${ideaId}`, idea),
  delete: (chapterId, ideaId) => del(`/chapters/${chapterId}/ideas/${ideaId}`),
};

export const excerptApi = {
  create: (chapterId, excerpt) => post(`/chapters/${chapterId}/excerpts`, excerpt),
  update: (chapterId, excerptId, excerpt) => put(`/chapters/${chapterId}/excerpts/${excerptId}`, excerpt),
  delete: (chapterId, excerptId) => del(`/chapters/${chapterId}/excerpts/${excerptId}`),
};

export const explanationApi = {
  get: (chapterId) => get(`/chapters/${chapterId}/explanation`),
  save: (chapterId, explanation) => put(`/chapters/${chapterId}/explanation`, explanation),
  delete: (chapterId) => del(`/chapters/${chapterId}/explanation`),
};

// Manual reading bookmarks ("I read up to here") on chapter explanations.
export const bookmarkApi = {
  create: (chapterId, { scrollRatio = null, note = '' } = {}) =>
    post(`/chapters/${chapterId}/bookmarks`, { scrollRatio, note }),
  list: (bookId = null, opts) => get(`/bookmarks${query({ bookId })}`, opts),
  delete: (id) => del(`/bookmarks/${id}`),
};

// Passages saved from chapter explanations (text + location), listed per book.
export const markApi = {
  create: (chapterId, mark) => post(`/chapters/${chapterId}/marks`, mark),
  // Where the chapter's passages stand after its explanation changed (or re-link one):
  // [{ id, orphaned, quote?, prefix?, suffix?, startOffset?, endOffset? }]. Answers the chapter's passages.
  updateAnchors: (chapterId, marks) => put(`/chapters/${chapterId}/marks/anchors`, { marks }),
  updateNote: (id, note) => patch(`/marks/${id}`, { note }),
  delete: (id) => del(`/marks/${id}`),
};

export const ideaBankApi = {
  search: ({ q = '', bookId = null, tag = '' } = {}, opts) => get(`/ideas${query({ q, bookId, tag })}`, opts),
};

export const excerptBankApi = {
  search: ({ q = '', bookId = null } = {}, opts) => get(`/excerpts${query({ q, bookId })}`, opts),
};

// Files per upload request: keeps each request well under the server's multipart limits.
export const IMAGE_UPLOAD_BATCH_SIZE = 20;

// Sends the files in sequential batches (so they keep their order) and merges the reports.
// If a batch fails, the earlier ones stay saved and the error is rethrown.
async function uploadImages(chapterId, files) {
  const all = Array.from(files);
  const result = { images: [], skipped: [] };
  for (let i = 0; i < all.length; i += IMAGE_UPLOAD_BATCH_SIZE) {
    const batch = all.slice(i, i + IMAGE_UPLOAD_BATCH_SIZE);
    const { images = [], skipped = [] } =
      await postForm(`/chapters/${chapterId}/images`, fileForm('files', batch));
    result.images.push(...images);
    result.skipped.push(...skipped);
  }
  return result;
}

export const chapterImageApi = {
  getAll: (chapterId, opts) => get(`/chapters/${chapterId}/images`, opts),
  upload: uploadImages,
  delete: (chapterId, imageId) => del(`/chapters/${chapterId}/images/${imageId}`),
  getUrl: (chapterId, imageId) => `${API_BASE}/chapters/${chapterId}/images/${imageId}/data`,
  getBlob: (chapterId, imageId, opts) =>
    request(`/chapters/${chapterId}/images/${imageId}/data`, opts).then(res => res.blob()),
};

// JSON import (FE-08): each call is one server transaction; bodies come from utils/jsonImport.js.
export const importApi = {
  books: (body) => post('/books/import', body),
  structure: (bookId, body) => post(`/books/${bookId}/import`, body),
  content: (bookId, body) => post(`/books/${bookId}/import/content`, body),
};

export const migrationApi = {
  // Export selected books (or all when bookIds is empty) as a ZIP archive blob.
  exportBooks: async (bookIds) => {
    const res = await request('/migration/export', withJson('POST', { bookIds: bookIds || [] }), 'Export failed');
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return { blob: await res.blob(), filename: match ? match[1] : 'books-export.zip' };
  },
  preview: (file) => postForm('/migration/import/preview', fileForm('file', [file])),
  import: (file) => postForm('/migration/import', fileForm('file', [file])),
};

export const reviewApi = {
  getAll: (opts) => get('/reviews', opts),
  create: (bookId, review) => post(`/books/${bookId}/reviews`, review),
  update: (bookId, reviewId, review) => put(`/books/${bookId}/reviews/${reviewId}`, review),
  delete: (bookId, reviewId) => del(`/books/${bookId}/reviews/${reviewId}`),
};

export const bookCollectionApi = {
  list: (opts) => get('/book-collections', opts),
  create: (name, parentId = null, sortOrder) => post('/book-collections', { name, parentId, sortOrder }),
  rename: (id, name) => put(`/book-collections/${id}`, { name }),
  move: (id, parentId) => put(`/book-collections/${id}/move`, { parentId }),
  remove: (id) => del(`/book-collections/${id}`),
  booksIn: (id, includeDescendants = false, opts) =>
    get(`/book-collections/${id}/books?includeDescendants=${includeDescendants}`, opts),
  collectionsForBook: (bookId) => get(`/book-collections/for-book/${bookId}`),
  addBook: (id, bookId) => post(`/book-collections/${id}/books/${bookId}`),
  removeBook: (id, bookId) => del(`/book-collections/${id}/books/${bookId}`),
};