const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

export const bookApi = {
  getAll: () => apiFetch(`${API_BASE}/books`),
  get: (id) => apiFetch(`${API_BASE}/books/${id}`),
  getCategories: () => apiFetch(`${API_BASE}/books/categories`),
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
  getAll: (bookId) => apiFetch(`${API_BASE}/books/${bookId}/chapters`),
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

export const ideaApi = {
  getAll: (chapterId) => apiFetch(`${API_BASE}/chapters/${chapterId}/ideas`),
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
  getAll: (chapterId) => apiFetch(`${API_BASE}/chapters/${chapterId}/excerpts`),
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

export const ideaBankApi = {
  search: ({ q = '', bookId = null, tag = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (bookId) params.set('bookId', bookId);
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    return apiFetch(`${API_BASE}/ideas${qs ? '?' + qs : ''}`);
  },
};

export const excerptBankApi = {
  search: ({ q = '', bookId = null } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (bookId) params.set('bookId', bookId);
    const qs = params.toString();
    return apiFetch(`${API_BASE}/excerpts${qs ? '?' + qs : ''}`);
  },
};

export const chapterImageApi = {
  getAll: (chapterId) => apiFetch(`${API_BASE}/chapters/${chapterId}/images`),
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

export const reviewApi = {
  getAll: () => apiFetch(`${API_BASE}/reviews`),
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
